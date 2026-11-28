import { eventFeed, type EventRow } from '@/features/blog/listFeeds'
import { excludeProtected } from '@/features/visibility/excludeProtected'
import { getEngine } from '@/lib/engine'
import { getFeatureFlags } from '@/utilities/features'
import { requestSiteOrigin } from '@/utilities/siteOrigin'

export const dynamic = 'force-dynamic'

/** RSS feed of upcoming and recent published events, newest start first. Off when the Events feature is off. */
export async function GET(request: Request): Promise<Response> {
  if (!(await getFeatureFlags()).events) return new Response('Not found', { status: 404 })
  const engine = await getEngine()
  const site = (await engine.findGlobal({ slug: 'site-settings', depth: 0 }).catch((): null => null)) as { siteName?: string | null } | null
  const found = await engine.find({ collection: 'events', where: { _status: { equals: 'published' } }, sort: '-startDate', limit: 30, depth: 1 } as never)
  const xml = eventFeed({ rows: await excludeProtected('events', found.docs as unknown as (EventRow & { id: number })[], null), baseUrl: await requestSiteOrigin(), selfUrl: request.url, siteName: site?.siteName ?? '' })
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=900, stale-while-revalidate=3600' } })
}
