import { resolveD1Binding } from '@/cms/db/connect'

import { AUDIT_PAGE_SIZE, buildAuditSelect, type AuditFilter } from './auditQuery'
import { AUDIT_TABLE } from './auditLog'

/**
 * Reads one page of account-security events for the admin review screen.
 * Server-only: it reaches D1. Writes are not here - they go through
 * recordAuthEvent (see authAudit.ts) and nothing edits or removes a row.
 */

export type AuthAuditRow = {
  id: number
  action: string
  actorId: number | null
  actorEmail: string | null
  collectionSlug: string | null
  documentId: string | null
  ip: string | null
  userAgent: string | null
  detail: string | null
  createdAt: string
}

type Raw = {
  id: number
  action: string
  actor_id: number | null
  actor_email: string | null
  collection_slug: string | null
  document_id: string | null
  ip: string | null
  user_agent: string | null
  detail: string | null
  created_at: string
}

const toRow = (raw: Raw): AuthAuditRow => ({
  id: Number(raw.id),
  action: raw.action,
  actorId: raw.actor_id === null ? null : Number(raw.actor_id),
  actorEmail: raw.actor_email,
  collectionSlug: raw.collection_slug,
  documentId: raw.document_id,
  ip: raw.ip,
  userAgent: raw.user_agent,
  detail: raw.detail,
  createdAt: raw.created_at,
})

export async function listAuthAuditPage(filter: AuditFilter, pageSize = AUDIT_PAGE_SIZE): Promise<{ rows: AuthAuditRow[]; hasNext: boolean }> {
  const d1 = await resolveD1Binding()
  const { sql, binds } = buildAuditSelect(filter, pageSize)
  const result = await d1.prepare(sql).bind(...binds).all<Raw>()
  const raw = result.results ?? []
  return { rows: raw.slice(0, pageSize).map(toRow), hasNext: raw.length > pageSize }
}

export type SettingsChange = { by: string | null; at: string }

/**
 * The latest settings save for each global slug, from the audit log. A save
 * with no signed-in actor (a script, a seed) comes back with `by` null.
 * Only `settings.update` rows count; one row per slug, the newest.
 */
export async function latestSettingsChanges(slugs: readonly string[]): Promise<Map<string, SettingsChange>> {
  const names = [...new Set(slugs)]
  const out = new Map<string, SettingsChange>()
  if (names.length === 0) return out
  const d1 = await resolveD1Binding()
  const marks = names.map(() => '?').join(', ')
  const sql = `SELECT collection_slug, actor_email, created_at FROM \`${AUDIT_TABLE}\`
    WHERE id IN (SELECT MAX(id) FROM \`${AUDIT_TABLE}\` WHERE action = 'settings.update' AND collection_slug IN (${marks}) GROUP BY collection_slug)`
  const result = await d1.prepare(sql).bind(...names).all<{ collection_slug: string; actor_email: string | null; created_at: string }>()
  for (const row of result.results ?? []) out.set(row.collection_slug, { by: row.actor_email, at: row.created_at })
  return out
}
