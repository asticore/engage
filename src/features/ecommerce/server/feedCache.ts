import type { D1 } from './feedRecords'

/** A built feed older than this is rebuilt, which also picks up price tier, currency rate and settings changes. */
export const FEED_CACHE_MAX_AGE_MS = 60 * 60 * 1000
/** D1 rows are limited to 2 MB; a larger feed is built on each request instead of cached. */
export const FEED_CACHE_MAX_BYTES = 1_500_000

type CachedFeed = { body: string; contentType: string }
type Stmt = { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<unknown> } }
type Db = { prepare: (sql: string) => Stmt } & Partial<D1>

/** The stored feed text, or null when none is stored, it is stale, or the table does not exist yet. */
export async function readFeedCache(d1: Db, feedId: number, origin: string, nowMs: number): Promise<CachedFeed | null> {
  try {
    const rows = (await d1.prepare('SELECT body, content_type, built_at FROM eg_product_feed_cache WHERE feed_id = ?1 AND origin = ?2').bind(feedId, origin).all<{ body: string; content_type: string; built_at: number }>()).results
    const row = rows[0]
    if (!row || nowMs - Number(row.built_at) > FEED_CACHE_MAX_AGE_MS) return null
    return { body: String(row.body), contentType: String(row.content_type) }
  } catch {
    return null
  }
}

/** Stores the built feed. Never throws: a failed write only means the next request builds again. */
export async function writeFeedCache(d1: Db, feedId: number, origin: string, feed: CachedFeed, nowMs: number): Promise<void> {
  if (feed.body.length > FEED_CACHE_MAX_BYTES) return
  try {
    await d1
      .prepare('INSERT INTO eg_product_feed_cache (feed_id, origin, content_type, body, built_at) VALUES (?1,?2,?3,?4,?5) ON CONFLICT(feed_id, origin) DO UPDATE SET content_type=?3, body=?4, built_at=?5')
      .bind(feedId, origin, feed.contentType, feed.body, nowMs)
      .run()
  } catch {
    // Cache only.
  }
}

/** Drops the stored text of one feed, or of every feed when no id is given. Never throws. */
export async function clearFeedCache(d1: Db, feedId?: number): Promise<void> {
  try {
    if (feedId) await d1.prepare('DELETE FROM eg_product_feed_cache WHERE feed_id = ?1').bind(feedId).run()
    else await d1.prepare('DELETE FROM eg_product_feed_cache').bind().run()
  } catch {
    // The table may not exist yet (shop never switched on).
  }
}
