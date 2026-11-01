/**
 * The suppression list screen's data: search, list and remove. Reads and writes
 * `eg_email_suppressions` directly (see suppression.ts for how addresses get on the
 * list). Removing an address lets it receive bulk and reminder mail again; it does
 * not change anything at the provider, so a complaint that the provider still
 * holds stays with the provider.
 */

import { resolveD1Binding } from '@/cms/db/connect'
import { SUPPRESSION_TABLE, type SuppressionReason } from './suppression'

export type SuppressionRow = { email: string; reason: SuppressionReason | string; source: string; createdAt: string }

const MAX_QUERY = 120
/** Escapes the LIKE wildcards so a search for "a_b" finds "a_b" and nothing wider. */
const likeEscape = (value: string): string => value.replace(/[\\%_]/g, (match) => `\\${match}`)

/** Addresses on the list, newest first. `query` matches part of an address (case-insensitive). */
export async function listSuppressions(query: string, limit = 100): Promise<SuppressionRow[]> {
  const q = query.trim().toLowerCase().slice(0, MAX_QUERY)
  const d1 = await resolveD1Binding()
  const statement = q
    ? d1
        .prepare(`SELECT email, reason, source, created_at FROM ${SUPPRESSION_TABLE} WHERE email LIKE ? ESCAPE '\\' ORDER BY created_at DESC LIMIT ?`)
        .bind(`%${likeEscape(q)}%`, limit)
    : d1.prepare(`SELECT email, reason, source, created_at FROM ${SUPPRESSION_TABLE} ORDER BY created_at DESC LIMIT ?`).bind(limit)
  const { results } = await statement.all<{ email: string; reason: string; source: string; created_at: string }>()
  return (results ?? []).map((row) => ({ email: String(row.email), reason: String(row.reason), source: String(row.source ?? ''), createdAt: String(row.created_at ?? '') }))
}

/** Removes one address from the list. Returns whether a row was removed. */
export async function removeSuppression(email: string): Promise<boolean> {
  const address = email.trim().toLowerCase()
  if (!address) return false
  const d1 = await resolveD1Binding()
  const res = await d1.prepare(`DELETE FROM ${SUPPRESSION_TABLE} WHERE email = ?`).bind(address).run()
  return (res.meta?.changes ?? 0) > 0
}
