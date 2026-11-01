import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { __setD1ForTests } from '@/features/redirects/resolve'
import { notFoundPathOf, recordNotFound, referrerOf, __resetNotFoundLogForTests, NOT_FOUND_WRITE_INTERVAL_MS } from '@/features/redirects/notFoundLog'

type Call = { sql: string; args: unknown[] }

const fakeDb = (calls: Call[]) => ({
  prepare(sql: string) {
    return {
      bind(...args: unknown[]) {
        calls.push({ sql, args })
        return {
          run: async (): Promise<Record<string, unknown>> => ({}),
          all: async (): Promise<{ results: unknown[] }> => ({ results: [] }),
          first: async (): Promise<null> => null,
        }
      },
    }
  },
})

describe('404 log paths and referrers', () => {
  it('keeps normal addresses and drops assets, the API, admin and over-long paths', () => {
    expect(notFoundPathOf('/old-page/?utm=1')).toBe('/old-page')
    expect(notFoundPathOf('/')).toBe('/')
    expect(notFoundPathOf('/logo.png')).toBeNull()
    expect(notFoundPathOf('/api/anything')).toBeNull()
    expect(notFoundPathOf('/admin/pages')).toBeNull()
    expect(notFoundPathOf('//evil.example')).toBeNull()
    expect(notFoundPathOf('/' + 'a'.repeat(600))).toBeNull()
    expect(notFoundPathOf(null)).toBeNull()
  })

  it('stores the referrer without its query string, and nothing for a bad one', () => {
    expect(referrerOf('https://news.example/story?id=9#top')).toBe('https://news.example/story')
    expect(referrerOf('not a url')).toBeNull()
    expect(referrerOf('')).toBeNull()
  })
})

describe('recordNotFound rate limit', () => {
  let calls: Call[]
  beforeEach(() => {
    calls = []
    __resetNotFoundLogForTests()
    __setD1ForTests(async () => fakeDb(calls) as never)
  })
  afterEach(() => {
    __setD1ForTests(null)
  })

  it('writes at most once a minute per path and adds the hits in between to the next write', async () => {
    const t0 = 1_000_000_000_000
    await recordNotFound('/gone', 'https://a.example/x?y=1', t0)
    await recordNotFound('/gone', null, t0 + 1000)
    await recordNotFound('/gone', null, t0 + 2000)
    expect(calls.filter((c) => c.sql.startsWith('INSERT'))).toHaveLength(1)
    expect(calls[0].args).toEqual(['/gone', 1, new Date(t0).toISOString(), 'https://a.example/x'])
    await recordNotFound('/gone', null, t0 + NOT_FOUND_WRITE_INTERVAL_MS + 1)
    const inserts = calls.filter((c) => c.sql.startsWith('INSERT'))
    expect(inserts).toHaveLength(2)
    expect(inserts[1].args[1]).toBe(3)
  })

  it('never throws when the database is missing or fails', async () => {
    __setD1ForTests(async () => {
      throw new Error('no d1')
    })
    await expect(recordNotFound('/broken', null, 5)).resolves.toBeUndefined()
  })
})
