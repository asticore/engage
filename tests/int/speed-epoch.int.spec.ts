import { beforeEach, describe, expect, it, vi } from 'vitest'

const runs: string[] = []
vi.mock('@/cms/db/connect', () => ({
  getDb: async () => ({
    run: async (query: { queryChunks?: unknown[] }) => {
      runs.push(JSON.stringify(query.queryChunks))
    },
    all: async () => [{ epoch: 1700000000 }],
  }),
}))

import { bumpCacheEpoch } from '@/features/speed/epoch'

describe('bumpCacheEpoch', () => {
  beforeEach(() => {
    runs.length = 0
  })
  it('bumps the epoch and creates the Speed row, with page cache on, when the site has none', async () => {
    expect(await bumpCacheEpoch()).toBe(1700000000)
    expect(runs).toHaveLength(2)
    expect(runs[0]).toContain('UPDATE eg_speed_settings')
    expect(runs[1]).toContain('INSERT INTO eg_speed_settings')
    expect(runs[1]).toContain('caching_page_cache')
    expect(runs[1]).toContain('NOT EXISTS')
  })
})
