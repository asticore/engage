import { renderFeed, tokenFromSegment } from '@/features/ecommerce/lib/feedRecords'
import { rawD1 } from '@/features/ecommerce/server/db'
import { getFeedByToken } from '@/features/ecommerce/server/feedRecords'
import { readFeedCache, writeFeedCache } from '@/features/ecommerce/server/feedCache'
import { loadFeedFor } from '@/features/ecommerce/server/feeds'

export const dynamic = 'force-dynamic'

/** A custom product feed at its secret address (`/feeds/custom/<token>.xml` or `.csv`). Unknown or switched-off feeds answer 404. */
export async function GET(request: Request, context: { params: Promise<{ token: string }> }): Promise<Response> {
  const token = tokenFromSegment((await context.params).token)
  if (!token) return new Response('Not found', { status: 404 })
  const record = await getFeedByToken(await rawD1(), token).catch((): null => null)
  if (!record || !record.enabled) return new Response('Not found', { status: 404 })
  // The extension must match the channel, so one token has exactly one address.
  const wantsXml = record.channel === 'google' || record.channel === 'xml'
  if (!(await context.params).token.endsWith(wantsXml ? '.xml' : '.csv')) return new Response('Not found', { status: 404 })
  const headers = (contentType: string, state: string): HeadersInit => ({ 'content-type': contentType, 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex', 'x-feed-cache': state })
  // Built text is stored per feed and site address; a product save or a feed change clears it (see feedCacheHook.ts).
  const d1 = await rawD1()
  const origin = new URL(request.url).origin
  const cached = await readFeedCache(d1, record.id, origin, Date.now())
  if (cached) return new Response(cached.body, { headers: headers(cached.contentType, 'hit') })
  const feed = await loadFeedFor(request, record)
  const { body, contentType } = renderFeed(record.channel, feed.items, { title: feed.title, link: feed.link })
  await writeFeedCache(d1, record.id, origin, { body, contentType }, Date.now())
  return new Response(body, { headers: headers(contentType, 'miss') })
}
