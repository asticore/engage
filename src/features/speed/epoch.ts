import { sql } from 'drizzle-orm'

import { getDb } from '@/cms/db/connect'

/**
 * Starts a new cache version for every stored page at once.
 *
 * The Worker builds its cache keys from `cache_epoch` on the Speed row, so
 * bumping it makes every saved copy unreachable within about ten seconds
 * (the Worker memoises the value that long). This runs on every publish while
 * page caching is on, on the "Clear cache now" button, and after any Speed
 * settings save.
 *
 * The new value is the larger of (old + 1) and the current Unix time in
 * seconds, so it only ever goes up, even if a save reset the column to its
 * default. When the site has no Speed row yet one is created. Returns the new epoch, or null when the write failed. Never throws.
 */
export async function bumpCacheEpoch(): Promise<number | null> {
  try {
    const db = await getDb()
    await db.run(
      sql`UPDATE eg_speed_settings SET cache_epoch = MAX(COALESCE(cache_epoch, 1) + 1, CAST(strftime('%s', 'now') AS INTEGER))`,
    )
    // A site that never saved the Speed screen has no row, and the page cache runs on defaults without one
    // (edgeCacheWorker). Make the row so the epoch has somewhere to live and publishes really do purge.
    await db.run(
      sql`INSERT INTO eg_speed_settings (id, cache_epoch, caching_page_cache) SELECT 1, CAST(strftime('%s', 'now') AS INTEGER), 1 WHERE NOT EXISTS (SELECT 1 FROM eg_speed_settings)`,
    )
    const rows = (await db.all(sql`SELECT cache_epoch AS epoch FROM eg_speed_settings LIMIT 1`)) as { epoch: number | string }[]
    const epoch = rows[0] ? Number(rows[0].epoch) : NaN
    return Number.isFinite(epoch) ? epoch : null
  } catch (error) {
    console.error('bumpCacheEpoch failed:', error)
    return null
  }
}