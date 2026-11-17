import { cached } from '@/features/google/dashboard/cache'
import { checkConnection, ga4PropertyNumber, searchSiteOrNull, type EngineArg } from '@/features/google/dashboard/connection'
import { liveRequester, type GoogleRequester } from '@/features/google/dashboard/requester'
import { shapeReport } from '@/features/google/dashboard/analytics'
import { shapeRows, shapeTotals } from '@/features/google/dashboard/searchConsole'
import { errorMessage } from '@/features/google/dashboard/shapeUtil'

import type { GoogleSection, SearchData, TrafficData } from './core'

/**
 * The Google numbers for a client report. They use the stored Google connection through the engine, so a client opening the report link
 * needs no sign-in. Each range is cached for five minutes (per property and dates), so a shared link cannot hammer Google.
 */

const TOP = 8
const DAY_MS = 86_400_000
const NOT_CONNECTED = 'Google is not connected on this site.'

type Range = { from: string; to: string }

/** Search Console data lags by about three days, so its end date is held back; a range that ends before it starts has no data yet. */
export function searchRange(range: Range, today: Date): Range | null {
  const limit = new Date(today.getTime() - 3 * DAY_MS).toISOString().slice(0, 10)
  const to = range.to > limit ? limit : range.to
  return to < range.from ? null : { from: range.from, to }
}

export async function loadTraffic(engine: EngineArg, range: Range, req: GoogleRequester = liveRequester): Promise<GoogleSection<TrafficData>> {
  const check = await checkConnection(engine)
  if (!check.connected) return { state: 'unavailable', message: NOT_CONNECTED }
  const property = ga4PropertyNumber(check.info.ga4PropertyId)
  if (!property) return { state: 'unavailable', message: 'No Google Analytics property is chosen.' }
  try {
    const data = await cached(
      `report-traffic:${property}:${range.from}:${range.to}`,
      async (): Promise<TrafficData> => {
        const url = `https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`
        const dateRanges = [{ startDate: range.from, endDate: range.to }]
        const [totals, pages, channels] = await Promise.all([
          req.post(engine, url, { dateRanges, metrics: [{ name: 'activeUsers' }, { name: 'sessions' }] }),
          req.post(engine, url, { dateRanges, dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }], orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: TOP }),
          req.post(engine, url, { dateRanges, dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: TOP }),
        ])
        const t = shapeReport(totals)[0]
        return {
          users: t?.metrics[0] ?? 0,
          sessions: t?.metrics[1] ?? 0,
          topPages: shapeReport(pages).map((r) => ({ path: r.dims[0] || '/', views: r.metrics[0] ?? 0 })),
          channels: shapeReport(channels).map((r) => ({ channel: r.dims[0] || 'Unknown', sessions: r.metrics[0] ?? 0 })),
        }
      },
      () => true,
    )
    return { state: 'ok', data }
  } catch (error) {
    return { state: 'unavailable', message: errorMessage(error) }
  }
}

export async function loadSearch(engine: EngineArg, range: Range, today: Date, req: GoogleRequester = liveRequester): Promise<GoogleSection<SearchData>> {
  const check = await checkConnection(engine)
  if (!check.connected) return { state: 'unavailable', message: NOT_CONNECTED }
  const site = searchSiteOrNull(check.info.searchConsoleSite)
  if (!site) return { state: 'unavailable', message: 'No Search Console site is chosen.' }
  const r = searchRange(range, today)
  if (!r) return { state: 'unavailable', message: 'Search Console has no data for these dates yet (it runs about three days behind).' }
  try {
    const data = await cached(
      `report-search:${site}:${r.from}:${r.to}`,
      async (): Promise<SearchData> => {
        const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`
        const window = { startDate: r.from, endDate: r.to }
        const [totals, queries, pages] = await Promise.all([
          req.post(engine, url, window),
          req.post(engine, url, { ...window, dimensions: ['query'], rowLimit: TOP }),
          req.post(engine, url, { ...window, dimensions: ['page'], rowLimit: TOP }),
        ])
        const t = shapeTotals(totals)
        const pick = (rows: ReturnType<typeof shapeRows>) => rows.map((x) => ({ key: x.key, clicks: x.clicks, impressions: x.impressions }))
        return { ...t, topQueries: pick(shapeRows(queries, TOP)), topPages: pick(shapeRows(pages, TOP)) }
      },
      () => true,
    )
    return { state: 'ok', data }
  } catch (error) {
    return { state: 'unavailable', message: errorMessage(error) }
  }
}
