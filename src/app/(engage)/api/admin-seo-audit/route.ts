import { NextResponse } from 'next/server'
import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { bulkPermissions } from '@/features/editScreens/authors'
import { AUDIT_COLLECTIONS, summariseAuditRows, type AuditCollection } from '@/features/seo/audit'
import { loadAuditRows, type AuditFindEngine } from '@/features/seo/auditLoader'
import { parseSeoEdits, seoEditData, type SeoEditRow } from '@/features/seo/auditEdits'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/**
 * GET /api/admin-seo-audit
 * Returns { rows, summary } for every published page, post, product and event
 * the signed-in user may read. Admin only (or a role that can read the place).
 */
export async function GET(): Promise<Response> {
  try {
    const context = await getAdminContext()
    if (!hasAdminPanelAccess(context.user)) return json({ error: 'Unauthorised' }, 401)

    const can = context.can as unknown as (resource: string, action: string) => boolean
    const allowed: AuditCollection[] = AUDIT_COLLECTIONS.filter((collection) => context.isAdmin || can(collection, 'read'))
    if (allowed.length === 0) return json({ error: 'Unauthorised' }, 401)

    const rows = await loadAuditRows(context.engine as unknown as AuditFindEngine, allowed)
    return json({ rows, summary: summariseAuditRows(rows) })
  } catch (error) {
    console.error('admin-seo-audit GET error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
}

/**
 * POST /api/admin-seo-audit
 *   { rows: [{ collection, id, metaTitle?, metaDescription? }] }   (at most 100 rows)
 * Saves the SEO title and meta description of each row in one request. Each row
 * is read and written as the signed-in user with access rules on, so a row the
 * user may not change fails on its own and the others still save. Answers
 * `{ results: [{ collection, id, ok, error? }] }`.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const context = await getAdminContext()
    if (!hasAdminPanelAccess(context.user)) return json({ error: 'Unauthorised' }, 401)

    const parsed = parseSeoEdits(await request.json().catch((): null => null))
    if ('error' in parsed) return json({ error: parsed.error }, 400)

    const engine = context.engine as unknown as {
      findByID(args: Record<string, unknown>): Promise<Record<string, unknown> | null>
      update(args: Record<string, unknown>): Promise<unknown>
    }
    const results: { collection: string; id: number | string; ok: boolean; error?: string }[] = []
    for (const row of parsed.rows as SeoEditRow[]) {
      const permissions = bulkPermissions(context as never, row.collection)
      if (!permissions.update) {
        results.push({ collection: row.collection, id: row.id, ok: false, error: 'You cannot edit this.' })
        continue
      }
      try {
        const current = await engine.findByID({ collection: row.collection, id: row.id, depth: 0, user: context.user, overrideAccess: false })
        if (!current || current.trashedAt) {
          results.push({ collection: row.collection, id: row.id, ok: false, error: 'Not found or not yours to change.' })
          continue
        }
        await engine.update({ collection: row.collection, id: row.id, data: seoEditData(current, row), user: context.user, overrideAccess: false })
        results.push({ collection: row.collection, id: row.id, ok: true })
      } catch (error) {
        results.push({ collection: row.collection, id: row.id, ok: false, error: error instanceof Error ? error.message : 'Could not save.' })
      }
    }
    return json({ results })
  } catch (error) {
    console.error('admin-seo-audit POST error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
}
