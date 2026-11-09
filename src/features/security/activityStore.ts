import { resolveD1Binding } from '@/cms/db/connect'

import {
  ACTIVITY_COLLECTIONS_SQL,
  ACTIVITY_PAGE_SIZE,
  buildActivityExport,
  buildActivitySelect,
  buildClearCount,
  buildClearDelete,
  describeScope,
  type ActivityFilter,
  type ClearScope,
} from './activityQuery'
import { AUDIT_TABLE } from './auditLog'
import type { AuthAuditRow } from './auditStore'

/** Server-only reads and the clear for the activity log. Rows are read-only elsewhere; this is the one sanctioned bulk removal. */

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

export async function listActivityPage(filter: ActivityFilter, pageSize = ACTIVITY_PAGE_SIZE): Promise<{ rows: AuthAuditRow[]; hasNext: boolean }> {
  const d1 = await resolveD1Binding()
  const { sql, binds } = buildActivitySelect(filter, pageSize)
  const result = await d1.prepare(sql).bind(...binds).all<Raw>()
  const raw = result.results ?? []
  return { rows: raw.slice(0, pageSize).map(toRow), hasNext: raw.length > pageSize }
}

export async function exportActivityRows(filter: ActivityFilter): Promise<Array<Record<string, unknown>>> {
  const d1 = await resolveD1Binding()
  const { sql, binds } = buildActivityExport(filter)
  const result = await d1.prepare(sql).bind(...binds).all<Record<string, unknown>>()
  return result.results ?? []
}

export async function listActivityCollections(): Promise<string[]> {
  const d1 = await resolveD1Binding()
  const result = await d1.prepare(ACTIVITY_COLLECTIONS_SQL).all<{ slug: string }>()
  return (result.results ?? []).map((r) => r.slug)
}

export async function countClearable(scope: ClearScope): Promise<number> {
  const d1 = await resolveD1Binding()
  const { sql, binds } = buildClearCount(scope)
  const row = await d1.prepare(sql).bind(...binds).first<{ n: number }>()
  return Number(row?.n ?? 0)
}

export type ClearActor = { id: number | string | null; email: string | null; ip: string | null; userAgent: string | null }

/**
 * Removes the entries in `scope` (never consent, privacy or clear records), then
 * writes one `activity.cleared` entry naming who cleared what and how many. The
 * record is written even when the audit log is switched off, because a clear
 * with no trace is exactly what the record exists to prevent.
 */
export async function clearActivity(scope: ClearScope, actor: ClearActor): Promise<number> {
  const d1 = await resolveD1Binding()
  const count = await countClearable(scope)
  const { sql, binds } = buildClearDelete(scope)
  await d1.prepare(sql).bind(...binds).run()
  const now = new Date().toISOString()
  const detail = `cleared ${count} entries (${describeScope(scope)})`.slice(0, 1000)
  await d1
    .prepare(
      `INSERT INTO \`${AUDIT_TABLE}\` (action, actor_id, actor_email, collection_slug, document_id, ip, user_agent, detail, created_at, updated_at)
       VALUES ('activity.cleared', ?, ?, NULL, NULL, ?, ?, ?, ?, ?)`,
    )
    .bind(actor.id === null ? null : Number(actor.id), actor.email, actor.ip, (actor.userAgent ?? '').slice(0, 255) || null, detail, now, now)
    .run()
  return count
}
