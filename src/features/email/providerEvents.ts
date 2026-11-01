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
