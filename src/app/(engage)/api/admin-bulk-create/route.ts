import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { adminRequestRefusal } from '@/features/forms/origin'
import { BULK_CREATE_COLLECTIONS, parseBulkInput, type BulkCreateCollection } from '@/features/bulkCreate/plan'
import { previewBulk, runBulk, undoBulk, type BulkEngine } from '@/features/bulkCreate/run'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const isCollection = (v: unknown): v is BulkCreateCollection => typeof v === 'string' && (BULK_CREATE_COLLECTIONS as readonly string[]).includes(v)

async function audit(action: 'bulk.created' | 'bulk.undone', who: { id?: number | string; email?: string }, detail: string): Promise<void> {
  try {
    const { recordAuditEvent } = await import('@/features/security/auditLog')
    const { getSecuritySettings } = await import('@/features/security/settings')
    const { getEngine } = await import('@/lib/engine')
    const settings = await getSecuritySettings((await getEngine()) as unknown as Parameters<typeof getSecuritySettings>[0])
    await recordAuditEvent({ action, actorId: who.id ?? null, actorEmail: who.email ?? null, detail }, { ...settings, featureEnabled: true, auditLog: { ...settings.auditLog, enabled: true } })
  } catch {
    // The batch already ran; the audit write is best effort and logs its own failure.
  }
}

/**
 * POST { action: 'preview' | 'create' | 'undo', collection, text?, ids? }
 * preview: the plan with problems, nothing written. create: draft documents for every row without a problem, one audit
 * entry for the batch. undo: removes still-draft documents of a batch made in the last day. Needs create permission.
 */
export async function POST(request: Request): Promise<Response> {
  const refusal = adminRequestRefusal(request)
  if (refusal) return json({ error: refusal }, 403)
  const context = await getAdminContext()
  if (!context.user) return json({ error: 'Please sign in again.' }, 401)
  const body = (await request.json().catch((): null => null)) as { action?: unknown; collection?: unknown; text?: unknown; ids?: unknown } | null
  if (!body || !isCollection(body.collection)) return json({ error: 'Pick pages, posts or products.' }, 400)
  const collection = body.collection
  const can = context.can as unknown as (resource: string, action: string) => boolean
  if (!context.isAdmin && !can(collection, 'create')) return json({ error: `You do not have permission to create ${collection}.` }, 403)
  const engine = context.engine as unknown as BulkEngine
  const who = context.user as { id?: number | string; email?: string }
  try {
    if (body.action === 'undo') {
      const ids = (Array.isArray(body.ids) ? body.ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200)
      if (ids.length === 0) return json({ error: 'Nothing to undo.' }, 400)
      const result = await undoBulk(engine, context.user, collection, ids, new Date())
      await audit('bulk.undone', who, `removed ${result.removed} draft ${collection} from a bulk batch`)
      return json(result)
    }
    const parsed = parseBulkInput(typeof body.text === 'string' ? body.text : '')
    if (parsed.rows.length === 0) return json({ error: parsed.errors[0] ?? 'Nothing to create.' }, 400)
    if (body.action === 'create') {
      const result = await runBulk(engine, context.user, collection, parsed.rows)
      await audit('bulk.created', who, `created ${result.created.length} draft ${collection} in one batch (${result.failed.length} failed, ${result.skipped} skipped)`)
      return json({ ...result, warnings: parsed.errors })
    }
    const rows = await previewBulk(engine, collection, parsed.rows)
    return json({ rows, warnings: parsed.errors, creatable: rows.filter((r) => r.ok).length })
  } catch (error) {
    console.error('admin-bulk-create error:', error)
    return json({ error: 'Something went wrong. Check the list and try again.' }, 500)
  }
}
