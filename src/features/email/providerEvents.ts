import type { SuppressionReason } from './suppression'

/**
 * Reads the delivery events a provider reports back (bounces and complaints),
 * so a bad or unwanted address can be put on the suppression list. Pure: the
 * route checks the key and writes the result.
 *
 * Postmark is the first feed (decided in Task 7): its webhook posts one JSON
 * record per event. Only events that mean "stop mailing this address" are
 * kept. A soft bounce (a full mailbox, a timeout) is not, because it may clear.
 */

export type ProviderEvent = { address: string; reason: SuppressionReason; type: string }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The suppression reason for one Postmark record, or null when it should not suppress anything. */
export function parsePostmarkEvent(body: unknown): ProviderEvent | null {
  if (!body || typeof body !== 'object') return null
  const record = body as Record<string, unknown>
  const type = typeof record.RecordType === 'string' ? record.RecordType : ''
  const raw = typeof record.Email === 'string' ? record.Email : typeof record.Recipient === 'string' ? record.Recipient : ''
  const address = raw.trim().toLowerCase()
  if (!EMAIL_PATTERN.test(address)) return null

  if (type === 'Bounce') {
    const hard = record.Type === 'HardBounce' || record.Inactive === true
    return hard ? { address, reason: 'bounced', type: String(record.Type ?? 'Bounce') } : null
  }
  if (type === 'SpamComplaint') return { address, reason: 'complaint', type }
  if (type === 'SubscriptionChange' && record.SuppressSending === true) return { address, reason: 'provider', type }
  return null
}

/** Compares two secrets without stopping at the first different character. */
export function sameSecret(expected: string, given: string): boolean {
  if (!expected || typeof given !== 'string') return false
  const a = new TextEncoder().encode(expected)
  const b = new TextEncoder().encode(given)
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i]
  return diff === 0
}

/*
 * The other providers (task 7b). Each parser reads one delivery report and returns the addresses it
 * stops mail to. Signature checks live in providerSignatures.ts; the routes check the signature first.
 * A record that is not a hard bounce or a complaint returns nothing, the same rule as Postmark.
 */

const cleanAddress = (value: unknown): string | null => {
  const address = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return EMAIL_PATTERN.test(address) ? address : null
}

/** Resend (Svix). `email.bounced` with a Permanent bounce, and `email.complained`. */
export function parseResendEvent(body: unknown): ProviderEvent[] {
  if (!body || typeof body !== 'object') return []
  const { type, data } = body as { type?: unknown; data?: Record<string, unknown> }
  const to = Array.isArray(data?.to) ? data.to : [data?.to]
  const addresses = to.map(cleanAddress).filter((a): a is string => a !== null)
  const bounce = data?.bounce as { type?: unknown } | undefined
  if (type === 'email.bounced' && bounce?.type === 'Permanent') return addresses.map((address) => ({ address, reason: 'bounced', type: 'Permanent' }))
  if (type === 'email.complained') return addresses.map((address) => ({ address, reason: 'complaint', type: 'complained' }))
  return []
}

/** SendGrid Event Webhook: an array of events. `bounce` is a hard bounce (soft ones arrive as `deferred`); `spamreport` is a complaint. */
export function parseSendgridEvents(body: unknown): ProviderEvent[] {
  if (!Array.isArray(body)) return []
  const out: ProviderEvent[] = []
  for (const item of body as Record<string, unknown>[]) {
    const address = cleanAddress(item?.email)
    if (!address) continue
    if (item.event === 'bounce') out.push({ address, reason: 'bounced', type: 'bounce' })
    if (item.event === 'spamreport') out.push({ address, reason: 'complaint', type: 'spamreport' })
  }
  return out
}

/** Mailgun: `failed` with severity permanent is a hard bounce; `complained` is a complaint. Reads the `event-data` object. */
export function parseMailgunEvent(eventData: unknown): ProviderEvent[] {
  if (!eventData || typeof eventData !== 'object') return []
  const record = eventData as Record<string, unknown>
  const address = cleanAddress(record.recipient)
  if (!address) return []
  if (record.event === 'failed' && record.severity === 'permanent') return [{ address, reason: 'bounced', type: 'failed' }]
  if (record.event === 'complained') return [{ address, reason: 'complaint', type: 'complained' }]
  return []
}

/** Brevo transactional webhook: one event per post. `hard_bounce`, `invalid_email` and `blocked` stop mail; `spam` is a complaint. */
export function parseBrevoEvent(body: unknown): ProviderEvent[] {
  if (!body || typeof body !== 'object') return []
  const record = body as Record<string, unknown>
  const address = cleanAddress(record.email)
  if (!address) return []
  const event = typeof record.event === 'string' ? record.event : ''
  if (event === 'hard_bounce' || event === 'invalid_email' || event === 'blocked') return [{ address, reason: 'bounced', type: event }]
  if (event === 'spam') return [{ address, reason: 'complaint', type: event }]
  return []
}

/** Mandrill: a form field `mandrill_events` holding a JSON array. `hard_bounce` and `spam` are kept. */
export function parseMandrillEvents(json: unknown): ProviderEvent[] {
  if (!Array.isArray(json)) return []
  const out: ProviderEvent[] = []
  for (const item of json as Record<string, unknown>[]) {
    const msg = (item?.msg ?? {}) as Record<string, unknown>
    const address = cleanAddress(msg.email)
    if (!address) continue
    if (item.event === 'hard_bounce') out.push({ address, reason: 'bounced', type: 'hard_bounce' })
    if (item.event === 'spam') out.push({ address, reason: 'complaint', type: 'spam' })
  }
  return out
}

/** Amazon SES through SNS: the `Message` of a Notification. A Permanent bounce or a Complaint, each recipient once. */
export function parseSesMessage(message: unknown): ProviderEvent[] {
  if (!message || typeof message !== 'object') return []
  const record = message as Record<string, unknown>
  const out: ProviderEvent[] = []
  if (record.notificationType === 'Bounce') {
    const bounce = record.bounce as { bounceType?: unknown; bouncedRecipients?: { emailAddress?: unknown }[] } | undefined
    if (bounce?.bounceType !== 'Permanent') return []
    for (const r of bounce.bouncedRecipients ?? []) {
      const address = cleanAddress(r.emailAddress)
      if (address) out.push({ address, reason: 'bounced', type: 'Permanent' })
    }
  }
  if (record.notificationType === 'Complaint') {
    const complaint = record.complaint as { complainedRecipients?: { emailAddress?: unknown }[] } | undefined
    for (const r of complaint?.complainedRecipients ?? []) {
      const address = cleanAddress(r.emailAddress)
      if (address) out.push({ address, reason: 'complaint', type: 'Complaint' })
    }
  }
  return out
}
