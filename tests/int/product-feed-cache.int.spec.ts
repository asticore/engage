import { describe, expect, it } from 'vitest'

import { clearFeedCache, FEED_CACHE_MAX_AGE_MS, FEED_CACHE_MAX_BYTES, readFeedCache, writeFeedCache } from '@/features/ecommerce/server/feedCache'

type Row = { feed_id: number; origin: string; content_type: string; body: string; built_at: number }

/** A tiny in-memory stand-in for the three statements the cache uses. */
function fakeD1(failing = false) {
  const rows: Row[] = []
  return {
    rows,
    prepare: (sql: string) => ({
      bind: (...a: unknown[]) => ({
        all: async <T>() => {
          if (failing) throw new Error('no such table')
          return { results: rows.filter((r) => r.feed_id === a[0] && r.origin === a[1]) as unknown as T[] }
        },
        run: async () => {
          if (failing) throw new Error('no such table')
          if (sql.startsWith('INSERT')) {
            const i = rows.findIndex((r) => r.feed_id === a[0] && r.origin === a[1])
            const row = { feed_id: a[0] as number, origin: a[1] as string, content_type: a[2] as string, body: a[3] as string, built_at: a[4] as number }
            if (i >= 0) rows[i] = row
            else rows.push(row)
          } else if (a.length) {
            for (let i = rows.length - 1; i >= 0; i--) if (rows[i].feed_id === a[0]) rows.splice(i, 1)
          } else rows.length = 0
        },
      }),
    }),
  }
}

describe('product feed cache', () => {
  it('stores and returns a built feed, per feed and site address', async () => {
    const d1 = fakeD1()
    await writeFeedCache(d1, 1, 'https://a.test', { body: '<xml/>', contentType: 'application/xml' }, 1000)
    expect(await readFeedCache(d1, 1, 'https://a.test', 2000)).toEqual({ body: '<xml/>', contentType: 'application/xml' })
    expect(await readFeedCache(d1, 1, 'https://b.test', 2000)).toBeNull()
    expect(await readFeedCache(d1, 2, 'https://a.test', 2000)).toBeNull()
  })
  it('overwrites on a rebuild', async () => {
    const d1 = fakeD1()
    await writeFeedCache(d1, 1, 'o', { body: 'one', contentType: 't' }, 1)
    await writeFeedCache(d1, 1, 'o', { body: 'two', contentType: 't' }, 2)
    expect(d1.rows).toHaveLength(1)
    expect((await readFeedCache(d1, 1, 'o', 3))?.body).toBe('two')
  })
  it('expires after the maximum age', async () => {
    const d1 = fakeD1()
    await writeFeedCache(d1, 1, 'o', { body: 'x', contentType: 't' }, 0)
    expect(await readFeedCache(d1, 1, 'o', FEED_CACHE_MAX_AGE_MS)).not.toBeNull()
    expect(await readFeedCache(d1, 1, 'o', FEED_CACHE_MAX_AGE_MS + 1)).toBeNull()
  })
  it('clears one feed or all feeds', async () => {
    const d1 = fakeD1()
    await writeFeedCache(d1, 1, 'o', { body: 'x', contentType: 't' }, 0)
    await writeFeedCache(d1, 2, 'o', { body: 'y', contentType: 't' }, 0)
    await clearFeedCache(d1, 1)
    expect(d1.rows.map((r) => r.feed_id)).toEqual([2])
    await clearFeedCache(d1)
    expect(d1.rows).toHaveLength(0)
  })
  it('does not store a feed too large for one row', async () => {
    const d1 = fakeD1()
    await writeFeedCache(d1, 1, 'o', { body: 'x'.repeat(FEED_CACHE_MAX_BYTES + 1), contentType: 't' }, 0)
    expect(d1.rows).toHaveLength(0)
  })
  it('never throws when the table is missing', async () => {
    const d1 = fakeD1(true)
    await expect(writeFeedCache(d1, 1, 'o', { body: 'x', contentType: 't' }, 0)).resolves.toBeUndefined()
    await expect(clearFeedCache(d1)).resolves.toBeUndefined()
    expect(await readFeedCache(d1, 1, 'o', 0)).toBeNull()
  })
})
