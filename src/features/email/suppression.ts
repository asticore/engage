import { resolveD1Binding } from '@/cms/db/connect'

/**
 * The suppression list (`eg_email_suppressions`): addresses that must not get
 * reminder or marketing mail. One row per address, stored lower-case. Filled by
 * the unsubscribe link (src/app/(engage)/api/email-unsubscribe), by hard bounces
 * and complaints reported by the provider (src/app/(engage)/api/email-events).
 * Read by sendEmail before any bulk send. Transactional mail (sign-in, orders)
 * does not consult it.
 */

export const SUPPRESSION_TABLE = '`eg_email_suppressions`'

export type SuppressionReason = 'unsubscribed' | 'bounced' | 'complaint' | 'provider'

const CHUNK = 50

/** Records an address on the list. A second report for the same address changes nothing. */
export async function suppressAddress(
  address: string,
  reason: SuppressionReason,
  source: string,
  now: Date = new Date(),
): Promise<boolean> {
  const email = address.trim().toLowerCase()
  if (!email) return false
  const d1 = await resolveD1Binding()
  const res = await d1
    .prepare(`INSERT OR IGNORE INTO ${SUPPRESSION_TABLE} (email, reason, source, created_at) VALUES (?, ?, ?, ?)`)
    .bind(email, reason, source, now.toISOString())
    .run()
  return (res.meta?.changes ?? 0) > 0
}

/** The lower-cased addresses, out of those given, that are on the list. Throws when the table cannot be read. */
export async function suppressedAmong(addresses: string[]): Promise<Set<string>> {
  const found = new Set<string>()
  const emails = [...new Set(addresses.map((a) => a.trim().toLowerCase()).filter(Boolean))]
  if (emails.length === 0) return found
  const d1 = await resolveD1Binding()
  for (let i = 0; i < emails.length; i += CHUNK) {
    const part = emails.slice(i, i + CHUNK)
    const marks = part.map(() => '?').join(', ')
    const { results } = await d1
      .prepare(`SELECT email FROM ${SUPPRESSION_TABLE} WHERE email IN (${marks})`)
      .bind(...part)
      .all<{ email: string }>()
    for (const row of results ?? []) found.add(String(row.email).toLowerCase())
  }
  return found
}
