import { NextResponse } from 'next/server'
import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { adminRequestRefusal } from '@/features/forms/origin'
import { AUDIT_COLLECTIONS } from '@/features/seo/audit'
import { AUDIT_LIMIT_PER_COLLECTION } from '@/features/seo/auditLoader'
import { MAX_LINKS_PER_BATCH, collectLinks } from '@/features/seo/linkCheck'
import { checkLinks } from '@/features/seo/linkCheckRun'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

type Engine = {
  find(args: Record<string, unknown>): Promise<{ docs: unknown[] }>
  create(args: Record<string, unknown>): Promise<unknown>
}

/**
 * GET /api/admin-seo-links
 * Every distinct link in the published content with up to five documents that make it. Admin only.
 */
export async function GET(): Promise<Response> {
  try {
    const context = await getAdminContext()
    if (!hasAdminPanelAccess(context.user) || !context.isAdmin) return json({ error: 'Unauthorised' }, 401)
    const engine = context.engine as unknown as Engine
    const docs: Array<{ collection: string; doc: Record<string, unknown> }> = []
    for (const collection of AUDIT_COLLECTIONS) {
      const { docs: found } = await engine.find({ collection, where: { _status: { equals: 'published' } }, limit: AUDIT_LIMIT_PER_COLLECTION, depth: 0, overrideAccess: true })
      for (const doc of found as Record<string, unknown>[]) if (!doc.trashedAt) docs.push({ collection, doc })
    }
    return json({ links: collectLinks(docs), batchSize: MAX_LINKS_PER_BATCH })
  } catch (error) {
    console.error('admin-seo-links GET error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
}

/**
 * POST /api/admin-seo-links
 *   { urls: string[] }                       checks up to 20 links and answers { results }
 *   { fromPath, toPath }                     adds a 301 redirect for a broken internal link
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const refusal = adminRequestRefusal(request)
    if (refusal) return refusal
    const context = await getAdminContext()
    if (!hasAdminPanelAccess(context.user) || !context.isAdmin) return json({ error: 'Unauthorised' }, 401)
    const body = (await request.json().catch((): null => null)) as { urls?: unknown; fromPath?: unknown; toPath?: unknown } | null
    if (!body) return json({ error: 'Invalid request' }, 400)

    if (Array.isArray(body.urls)) {
      const urls = body.urls.filter((u): u is string => typeof u === 'string' && u.length < 2000).slice(0, MAX_LINKS_PER_BATCH)
      return json({ results: await checkLinks(urls, new URL(request.url).origin) })
    }
    if (typeof body.fromPath === 'string' && typeof body.toPath === 'string') {
      const from = body.fromPath.split(/[?#]/)[0]
      const to = body.toPath.trim()
      if (!from.startsWith('/') || !(to.startsWith('/') || /^https?:\/\//i.test(to)) || to.startsWith('//')) return json({ error: 'Use a path that starts with / for both, or a full https address for the new one.' }, 400)
      if (from.replace(/\/+$/, '') === to.replace(/\/+$/, '')) return json({ error: 'The new address is the same as the old one.' }, 400)
      await (context.engine as unknown as Engine).create({ collection: 'redirects', data: { fromPath: from, toPath: to, redirectType: '301', enabled: true, note: 'Added from the broken link checker' }, user: context.user })
      return json({ ok: true })
    }
    return json({ error: 'Invalid request' }, 400)
  } catch (error) {
    console.error('admin-seo-links POST error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
}
