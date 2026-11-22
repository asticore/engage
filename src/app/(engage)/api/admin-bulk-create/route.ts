import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { adminRequestRefusal } from '@/features/forms/origin'
import { BULK_CREATE_COLLECTIONS, applyBulkDefaults, parseBulkInput, type BulkCreateCollection } from '@/features/bulkCreate/plan'
import { previewBulk, runBulk, undoBulk, type BulkEngine } from '@/features/bulkCreate/run'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
type Defaults = { parent?: unknown; template?: unknown; status?: unknown; locale?: unknown }
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

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
  const body = (await request.json().catch((): null => null)) as { action?: unknown; collection?: unknown; text?: unknown; ids?: unknown; defaults?: Defaults } | null
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
    if (body.action === 'options') {
      const [pages, templates, settings] = await Promise.all([
        engine.find({ collection: 'pages', limit: 1000, depth: 0, pagination: false, overrideAccess: false, user: context.user }).catch((): { docs: Record<string, unknown>[] } => ({ docs: [] })),
        engine.find({ collection: 'page-templates', limit: 500, depth: 0, pagination: false, overrideAccess: false, user: context.user }).catch((): { docs: Record<string, unknown>[] } => ({ docs: [] })),
        (async () => {
          const { getMultilingualSettings } = await import('@/features/multilingual/settings')
          return getMultilingualSettings(context.engine as unknown as Parameters<typeof getMultilingualSettings>[0])
        })().catch((): null => null),
      ])
      return json({
        parents: pages.docs.filter((d) => !d.trashedAt && typeof d.slug === 'string' && d.slug).map((d) => ({ slug: String(d.slug), title: String(d.title ?? d.slug) })),
        templates: templates.docs.map((t) => ({ id: String(t.id), title: String(t.title ?? t.name ?? t.id) })),
        locales: settings && settings.enabled ? settings.activeLocales : [],
        defaultLocale: settings?.defaultLocale ?? '',
      })
    }
    const parsed = parseBulkInput(typeof body.text === 'string' ? body.text : '')
    const d = body.defaults ?? {}
    const status = d.status === 'published' && (context.isAdmin || can('pages', 'publish')) ? 'published' : 'draft'
    if (collection === 'pages') parsed.rows = applyBulkDefaults(parsed.rows, { parent: str(d.parent), template: str(d.template) })
    if (parsed.rows.length === 0) return json({ error: parsed.errors[0] ?? 'Nothing to create.' }, 400)
    if (body.action === 'create') {
      let defaultLocale = ''
      if (str(d.locale)) {
        const { getMultilingualSettings } = await import('@/features/multilingual/settings')
        const ml = await getMultilingualSettings(context.engine as unknown as Parameters<typeof getMultilingualSettings>[0]).catch((): null => null)
        if (ml?.enabled && ml.activeLocales.includes(str(d.locale))) defaultLocale = ml.defaultLocale
        else d.locale = ''
      }
      const result = await runBulk(engine, context.user, collection, parsed.rows, { status, locale: str(d.locale), defaultLocale })
      await audit('bulk.created', who, `created ${result.created.length} ${status === 'published' && collection === 'pages' ? 'published' : 'draft'} ${collection} in one batch (${result.failed.length} failed, ${result.skipped} skipped)`)
      return json({ ...result, warnings: parsed.errors })
    }
    const rows = await previewBulk(engine, collection, parsed.rows)
    return json({ rows, warnings: parsed.errors, creatable: rows.filter((r) => r.ok).length })
  } catch (error) {
    console.error('admin-bulk-create error:', error)
    return json({ error: 'Something went wrong. Check the list and try again.' }, 500)
  }
}
