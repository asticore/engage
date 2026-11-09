import { NextResponse } from 'next/server'
import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { addCategory, deleteCategory, linkedDocIds, listCategoriesSafe, moveCategory, renameCategory, reorderCategory, setCategoryLinks } from '@/features/categories/store'
import { descendantIds, isScope } from '@/features/categories/tree'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const intOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null)

async function guard(): Promise<Response | null> {
  const context = await getAdminContext()
  if (!hasAdminPanelAccess(context.user) || !context.isAdmin) return json({ error: 'Forbidden' }, 403)
  return null
}

/** GET /api/admin-categories?scope=shop[&links=<categoryId>]  The tree rows, or the product ids linked to one category. */
export async function GET(request: Request): Promise<Response> {
  try {
    const denied = await guard()
    if (denied) return denied
    const url = new URL(request.url)
    const scope = url.searchParams.get('scope')
    if (!isScope(scope)) return json({ error: 'Unknown scope' }, 400)
    const rows = await listCategoriesSafe(scope)
    const links = Number(url.searchParams.get('links'))
    if (Number.isInteger(links) && links > 0) return json({ ids: await linkedDocIds([links]), subtree: descendantIds(rows, links).length })
    return json({ rows })
  } catch (error) {
    console.error('admin-categories GET error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
}

/**
 * POST /api/admin-categories  { scope, action: add|rename|move|reorder|delete|links, ... }
 * Admins only. Every action answers { ok } or { ok:false, error } (400) so the screen can say why.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const denied = await guard()
    if (denied) return denied
    const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
    if (!body || !isScope(body.scope)) return json({ error: 'Unknown scope' }, 400)
    const scope = body.scope
    const id = intOrNull(body.id)
    let result
    switch (body.action) {
      case 'add':
        result = await addCategory(scope, typeof body.name === 'string' ? body.name : '', intOrNull(body.parentId))
        break
      case 'rename':
        result = id === null ? { ok: false as const, error: 'missing' as const } : await renameCategory(scope, id, typeof body.name === 'string' ? body.name : '', typeof body.slug === 'string' ? body.slug : undefined)
        break
      case 'move':
        result = id === null ? { ok: false as const, error: 'missing' as const } : await moveCategory(scope, id, intOrNull(body.parentId))
        break
      case 'reorder':
        result = id === null || (body.direction !== 'up' && body.direction !== 'down') ? { ok: false as const, error: 'missing' as const } : await reorderCategory(scope, id, body.direction)
        break
      case 'delete':
        result = id === null ? { ok: false as const, error: 'missing' as const } : await deleteCategory(scope, id)
        break
      case 'links':
        result = id === null || !Array.isArray(body.docIds) ? { ok: false as const, error: 'missing' as const } : await setCategoryLinks(scope, id, body.docIds.filter((n): n is number => typeof n === 'number'))
        break
      default:
        return json({ error: 'Unknown action' }, 400)
    }
    return json(result, result.ok ? 200 : 400)
  } catch (error) {
    console.error('admin-categories POST error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
}
