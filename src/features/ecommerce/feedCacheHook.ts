/**
 * afterChange and afterDelete on Products: the stored custom feeds are dropped so the next request rebuilds them. Never throws.
 * The database modules are loaded on use so this hook adds no import to the Products collection config.
 */
export async function feedCacheAfterWrite<T>({ doc }: { doc: T }): Promise<T> {
  try {
    const [{ rawD1 }, { clearFeedCache }] = await Promise.all([import('./server/db'), import('./server/feedCache')])
    await clearFeedCache(await rawD1())
  } catch {
    // Best effort: the hourly expiry still refreshes the feed.
  }
  return doc
}
