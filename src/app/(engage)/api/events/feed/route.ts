import { getEngine } from '@/engine'
import { excludeProtected } from '@/features/visibility/excludeProtected'
import { buildEventsCalendar, type IcsEventSource } from '@/features/editScreens/ics'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

/** GET /api/events/feed - every published, unprotected upcoming event as one subscribable iCalendar feed. */
export async function GET(request: Request): Promise<Response> {
  const flags = await getFeatureFlags()
  if (!flags.events) return new Response('Not found', { status: 404 })
  const engine = await getEngine()
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { docs } = (await engine.find({
    collection: 'events',
    where: { and: [{ _status: { equals: 'published' } }, { startDate: { greater_than_equal: since } }] },
    sort: 'startDate',
    limit: 500,
    depth: 0,
  })) as unknown as { docs: (IcsEventSource & { trashedAt?: string | null })[] }
  const visible = (await excludeProtected('events', docs.filter((d) => !d.trashedAt) as never)) as unknown as IcsEventSource[]
  const ics = buildEventsCalendar(visible, new URL(request.url).origin)
  return new Response(ics, { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=900' } })
}
