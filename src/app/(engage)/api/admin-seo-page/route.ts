import { NextResponse } from 'next/server'
import { drizzle } from 'drizzle-orm/d1'
import { getCloudflareContext } from '@opennextjs/cloudflare'

import { getAdminContext } from '@/admin/auth'
import { assertDocAccess, docAccessDenied } from '@/features/roles/docAccess'
import { resolveDocTarget } from '@/features/pagespeed/service'
import { isPageSpeedCollection, type PageSpeedCollection } from '@/features/pagespeed/types'
import { parseHtmlFacts } from '@/features/seo/crawl/htmlFacts'
import { ownChecklist, ownScores } from '@/features/seo/pageCheck'
import { SNIPPET_TYPES, detectSnippetTypes, richResultsTestUrl, suggestSnippetTypes } from '@/features/seo/snippets'
import { readTargets, writeTargets } from '@/features/seo/snippetTargets'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * The page overview (Task 6, items 16m and 16n).
 *   GET  ?collection=<pages|posts|products|events>&id=<docId>
 *        Loads the live page and answers { snippets, targets, suggested, catalogue, checklist, scores, testUrl }:
 *        which Google snippet types the page has, which the author ticked, and our own accessibility, SEO and technical
 *        checks (the PageSpeed checklist for the same page comes from /api/admin-pagespeed).
 *   POST { collection, id, types: string[] }   saves the ticked target snippet types.
 * The address loaded is built on the server from the document's own slug, never taken from the request.
 */

const noStore = { 'Cache-Control': 'no-store' }
const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: noStore })
const parseId = (value: unknown): number | null => {
  const id = typeof value === 'string' ? Number(value) : value
  return typeof id === 'number' && Number.isInteger(id) && id > 0 ? id : null
}

type Ctx = Awaited<ReturnType<typeof getAdminContext>>
const allowed = (context: Ctx, collection: PageSpeedCollection, action: 'read' | 'update'): boolean => context.isAdmin || Boolean(context.permissions.collections?.[collection]?.[action])

async function loadPage(url: string): Promise<{ html: string; status: number; ms: number } | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)
  const started = Date.now()
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (compatible; SiteAuditCrawler/1.0)', accept: 'text/html' } })
    const html = (await response.text()).slice(0, 1_500_000)
    return { html, status: response.status, ms: Date.now() - started }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const context = await getAdminContext()
    if (!context.user) return json({ error: 'unauthorised' }, 401)
    const params = new URL(request.url).searchParams
    const collection = params.get('collection')
    const id = parseId(params.get('id'))
    if (!isPageSpeedCollection(collection)) return json({ error: 'Invalid collection' }, 400)
    if (id === null) return json({ error: 'Invalid id' }, 400)
    if (!allowed(context, collection, 'read')) return json({ error: 'unauthorised' }, 401)
    const access = await assertDocAccess(context, collection, id, 'read')
    if (!access.ok) return docAccessDenied(access)

    const { env } = await getCloudflareContext({ async: true })
    const db = drizzle(env.D1) as never
    const resolved = await resolveDocTarget(context.engine as never, collection, id)
    const targets = await readTargets(db, collection, id).catch((): string[] => [])
    const catalogue = SNIPPET_TYPES.map((t) => ({ id: t.id, label: t.label, kind: t.kind, markupOnly: t.markupOnly === true, howTo: t.howTo }))
    if (!resolved.found) return json({ error: 'Document not found.' }, 404)
    if (resolved.target.ok === false) return json({ testable: false, reason: resolved.target.reason, targets, catalogue, suggested: suggestSnippetTypes(collection, false) })

    const url = resolved.target.url
    const page = await loadPage(url)
    if (!page || page.status >= 400) return json({ testable: false, reason: 'The live page could not be loaded. Check that it is published and not password protected.', targets, catalogue, suggested: suggestSnippetTypes(collection, false) })
    const facts = parseHtmlFacts(page.html)
    const path = new URL(url).pathname
    const checklist = ownChecklist(facts, { path, statusCode: page.status, responseMs: page.ms, inSitemap: true })
    return json({
      testable: true,
      url,
      testUrl: richResultsTestUrl(url),
      snippets: detectSnippetTypes(facts),
      targets,
      suggested: suggestSnippetTypes(collection, facts.videos > 0),
      catalogue,
      checklist,
      scores: ownScores(checklist),
    })
  } catch (error) {
    console.error('admin-seo-page GET error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const context = await getAdminContext()
    if (!context.user) return json({ error: 'unauthorised' }, 401)
    const body = (await request.json().catch((): null => null)) as { collection?: unknown; id?: unknown; types?: unknown } | null
    const id = parseId(body?.id)
    if (!isPageSpeedCollection(body?.collection)) return json({ error: 'Invalid collection' }, 400)
    if (id === null) return json({ error: 'Invalid id' }, 400)
    if (!Array.isArray(body?.types)) return json({ error: 'Send a list of types.' }, 400)
    if (!allowed(context, body.collection, 'update')) return json({ error: 'unauthorised' }, 401)
    const access = await assertDocAccess(context, body.collection, id, 'update')
    if (!access.ok) return docAccessDenied(access)
    const { env } = await getCloudflareContext({ async: true })
    const types = await writeTargets(drizzle(env.D1) as never, body.collection, id, body.types.map(String))
    return json({ targets: types })
  } catch (error) {
    console.error('admin-seo-page POST error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
}
