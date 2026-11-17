import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { adminRequestRefusal } from '@/features/forms/origin'
import { feedPath, parseFeedInput, renderFeed, validateFeed } from '@/features/ecommerce/lib/feedRecords'
import { rawD1 } from '@/features/ecommerce/server/db'
import { clearFeedCache } from '@/features/ecommerce/server/feedCache'
import { deleteFeed, getFeed, listFeeds, rotateFeedToken, saveFeed } from '@/features/ecommerce/server/feedRecords'
import { loadFeedFor } from '@/features/ecommerce/server/feeds'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function guard(request: Request, write: boolean): Promise<Response | null> {
  if (write) {
    const refusal = adminRequestRefusal(request)
    if (refusal) return json({ error: refusal }, 403)
  }
  const ctx = await getAdminContext()
  if (!ctx.user) return json({ error: 'Unauthorised' }, 401)
  if (!ctx.isAdmin) return json({ error: 'Forbidden' }, 403)
  return null
}

/** GET: every feed with its address. GET ?preview=<id>: the first 20 rows and what the channel would reject. Admin only. */
export async function GET(request: Request): Promise<Response> {
  const denied = await guard(request, false)
  if (denied) return denied
  const d1 = await rawD1()
  const previewId = Number(new URL(request.url).searchParams.get('preview'))
  if (Number.isInteger(previewId) && previewId > 0) {
    const feed = await getFeed(d1, previewId).catch((): null => null)
    if (!feed) return json({ error: 'Feed not found.' }, 404)
    const loaded = await loadFeedFor(request, feed)
    const rendered = renderFeed(feed.channel, loaded.items.slice(0, 20), { title: loaded.title, link: loaded.link })
    return json({ total: loaded.items.length, problems: validateFeed(feed.channel, loaded.items), sample: rendered.body.slice(0, 6000) })
  }
  const origin = new URL(request.url).origin
  const feeds = (await listFeeds(d1)).map((f) => ({ ...f, url: `${origin}${feedPath(f)}` }))
  return json({ feeds })
}

/** POST { id?, ...fields } saves; { id, action: 'rotate' } makes a new address; { id, action: 'delete' } removes the feed. Admin only. */
export async function POST(request: Request): Promise<Response> {
  const denied = await guard(request, true)
  if (denied) return denied
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'Send the feed details.' }, 400)
  const d1 = await rawD1()
  const id = Number(body.id)
  const hasId = Number.isInteger(id) && id > 0
  const now = new Date().toISOString()
  if (body.action === 'rotate' || body.action === 'delete') {
    if (!hasId) return json({ error: 'Pick a feed.' }, 400)
    if (body.action === 'rotate') await rotateFeedToken(d1, id, now)
    else await deleteFeed(d1, id)
    await clearFeedCache(d1, id)
    return json({ ok: true })
  }
  const parsed = parseFeedInput(body)
  if (parsed.ok === false) return json({ error: parsed.error }, 400)
  if (hasId && !(await getFeed(d1, id).catch((): null => null))) return json({ error: 'Feed not found.' }, 404)
  await saveFeed(d1, hasId ? id : null, parsed.feed, now)
  if (hasId) await clearFeedCache(d1, id)
  return json({ ok: true })
}
