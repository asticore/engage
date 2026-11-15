import { isFeedChannel, type FeedInput, type FeedRecord } from '../lib/feedRecords'

type Stmt = { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<unknown> } }
export type D1 = { prepare: (sql: string) => Stmt }

const COLUMNS = 'id, name, channel, token, currency, price_tier, category, tag, include_out_of_stock, enabled'

const toFeed = (r: Record<string, unknown>): FeedRecord | null => {
  if (!isFeedChannel(r.channel)) return null
  return {
    id: Number(r.id),
    name: String(r.name ?? ''),
    channel: r.channel,
    token: String(r.token ?? ''),
    currency: String(r.currency ?? ''),
    priceTier: String(r.price_tier ?? ''),
    category: String(r.category ?? ''),
    tag: String(r.tag ?? ''),
    includeOutOfStock: Number(r.include_out_of_stock) === 1,
    enabled: Number(r.enabled) !== 0,
  }
}

/** 32 hex characters from the platform's random source. */
export function newFeedToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Every feed. A missing table (shop not switched on) means no feeds. */
export async function listFeeds(d1: D1): Promise<FeedRecord[]> {
  try {
    const rows = (await d1.prepare(`SELECT ${COLUMNS} FROM eg_product_feeds ORDER BY id`).bind().all<Record<string, unknown>>()).results
    return rows.map(toFeed).filter((f): f is FeedRecord => f !== null)
  } catch {
    return []
  }
}

export async function getFeedByToken(d1: D1, token: string): Promise<FeedRecord | null> {
  try {
    const rows = (await d1.prepare(`SELECT ${COLUMNS} FROM eg_product_feeds WHERE token = ?1`).bind(token).all<Record<string, unknown>>()).results
    return rows[0] ? toFeed(rows[0]) : null
  } catch {
    return null
  }
}

export async function getFeed(d1: D1, id: number): Promise<FeedRecord | null> {
  const rows = (await d1.prepare(`SELECT ${COLUMNS} FROM eg_product_feeds WHERE id = ?1`).bind(id).all<Record<string, unknown>>()).results
  return rows[0] ? toFeed(rows[0]) : null
}

export async function saveFeed(d1: D1, id: number | null, feed: FeedInput, nowIso: string): Promise<void> {
  const values = [feed.name, feed.channel, feed.currency, feed.priceTier, feed.category, feed.tag, feed.includeOutOfStock ? 1 : 0, feed.enabled ? 1 : 0, nowIso]
  if (id) {
    await d1.prepare('UPDATE eg_product_feeds SET name=?1, channel=?2, currency=?3, price_tier=?4, category=?5, tag=?6, include_out_of_stock=?7, enabled=?8, updated_at=?9 WHERE id=?10').bind(...values, id).run()
  } else {
    await d1.prepare('INSERT INTO eg_product_feeds (name, channel, currency, price_tier, category, tag, include_out_of_stock, enabled, updated_at, created_at, token) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?9,?10)').bind(...values, newFeedToken()).run()
  }
}

export async function rotateFeedToken(d1: D1, id: number, nowIso: string): Promise<void> {
  await d1.prepare('UPDATE eg_product_feeds SET token = ?1, updated_at = ?2 WHERE id = ?3').bind(newFeedToken(), nowIso, id).run()
}

export async function deleteFeed(d1: D1, id: number): Promise<void> {
  await d1.prepare('DELETE FROM eg_product_feeds WHERE id = ?1').bind(id).run()
}
