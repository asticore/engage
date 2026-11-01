import { NextResponse } from 'next/server'
import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { createRedirect, findRedirects } from '@/cms/db/collections/redirects'
import { invalidateRedirectsCache } from '@/features/redirects/resolve'
import { validateRedirect, type RedirectType } from '@/features/redirects/validate'
import { deleteNotFoundRow, findNotFoundRow } from '@/features/redirects/notFoundLog'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const REDIRECT_TYPES = ['301', '302', '307', '308']

/**
 * POST /api/admin-not-found-log
 *   { action: 'redirect', id, toPath, redirectType }  turns a logged 404 into a redirect and drops the row
 *   { action: 'dismiss', id }                          drops a logged 404 without a redirect
 * Needs create (redirect) or update (dismiss) on Redirects. The new redirect goes through
 * the same validation as the redirect form (no loops, no reserved paths, no duplicate).
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const context = await getAdminContext()
    if (!hasAdminPanelAccess(context.user)) return json({ error: 'Unauthorised' }, 401)
    const body = (await request.json().catch((): null => null)) as { action?: unknown; id?: unknown; toPath?: unknown; redirectType?: unknown } | null
    const id = typeof body?.id === 'number' ? body.id : Number(body?.id)
    if (!Number.isInteger(id) || id <= 0) return json({ error: 'A logged 404 is needed' }, 400)
    const row = await findNotFoundRow(id)
    if (!row) return json({ error: 'That 404 is no longer logged' }, 404)

    if (body?.action === 'dismiss') {
      if (!(context.isAdmin || context.can('redirects', 'update'))) return json({ error: 'Forbidden' }, 403)
      await deleteNotFoundRow(id)
      return json({ ok: true })
    }

    if (body?.action !== 'redirect') return json({ error: 'Unknown action' }, 400)
    if (!(context.isAdmin || context.can('redirects', 'create'))) return json({ error: 'Forbidden' }, 403)
    const toPath = typeof body.toPath === 'string' ? body.toPath.trim() : ''
    const redirectType = typeof body.redirectType === 'string' && REDIRECT_TYPES.includes(body.redirectType) ? body.redirectType : '301'
    const existing = (await findRedirects({ limit: 10000 })).map((r) => ({ id: r.id, fromPath: r.fromPath, toPath: r.toPath, enabled: r.enabled !== false }))
    const errors = validateRedirect({ fromPath: row.path, toPath, redirectType: redirectType as RedirectType }, existing)
    if (errors.length > 0) return json({ error: errors.join(' ') }, 400)

    await createRedirect({ fromPath: row.path, toPath, redirectType: redirectType as '301' | '302' | '307' | '308', enabled: true, note: 'Created from a 404' })
    await deleteNotFoundRow(id)
    invalidateRedirectsCache()
    return json({ ok: true })
  } catch (error) {
    console.error('admin-not-found-log POST error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
}
