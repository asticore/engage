import { getCloudflareContext } from '@opennextjs/cloudflare'

export * from './outboundShared'

/** Outbound click log for external and affiliate products (Task 31d). Counters only: no visitor identifier. */

export const OUTBOUND_TABLE = 'eg_outbound_clicks'

type Bound = { run: () => Promise<unknown>; all: <T>() => Promise<{ results?: T[] }> }
type D1Like = { prepare: (s: string) => { bind: (...v: unknown[]) => Bound } }

const getDb = async (): Promise<D1Like | null> => {
  try {
    const { env } = await getCloudflareContext({ async: true })
    return ((env as { D1?: D1Like }).D1 as D1Like) ?? null
  } catch {
    return null
  }
}

export async function recordOutboundClick(productId: number, source: string, day: string): Promise<boolean> {
  const db = await getDb()
  if (!db) return false
  try {
    await db
      .prepare(`INSERT INTO \`${OUTBOUND_TABLE}\` (product_id, source, day, clicks) VALUES (?, ?, ?, 1) ON CONFLICT(product_id, source, day) DO UPDATE SET clicks = clicks + 1`)
      .bind(productId, source, day)
      .run()
    return true
  } catch {
    return false
  }
}

export type ClickRow = { source: string; clicks: number }

/** Clicks per source for one product from a day onward, busiest first. */
export async function readProductClicks(productId: number, fromDay: string): Promise<ClickRow[]> {
  const db = await getDb()
  if (!db) return []
  try {
    const { results } = await db
      .prepare(`SELECT source, SUM(clicks) AS clicks FROM \`${OUTBOUND_TABLE}\` WHERE product_id = ? AND day >= ? GROUP BY source ORDER BY clicks DESC LIMIT 50`)
      .bind(productId, fromDay)
      .all<{ source: string; clicks: number }>()
    return (results ?? []).map((r) => ({ source: String(r.source), clicks: Number(r.clicks) }))
  } catch {
    return []
  }
}
