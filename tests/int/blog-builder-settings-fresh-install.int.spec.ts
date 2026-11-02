// @vitest-environment node
// Blog builder settings on a genuinely empty D1: runInternalMigrate alone must add the brand voice and saved
// prompts columns to the Integrations table and the draft key to the AI usage table; a second run changes nothing.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPlatformProxy } from 'wrangler'

import { consoleLogger } from '@/localapi/logger'
import { runInternalMigrate, type InternalMigrateResult } from '@/migrations/runInternalMigrate'

describe('blog builder settings - fresh install on an empty D1', () => {
  let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ D1: D1Database }>>>
  let first: InternalMigrateResult
  let second: InternalMigrateResult

  const columnsOf = async (table: string): Promise<string[]> => {
    const result = await proxy.env.D1.prepare(`PRAGMA table_info(\`${table}\`)`).all()
    return (result.results as { name: string }[]).map((r) => r.name)
  }

  beforeAll(async () => {
    proxy = await getPlatformProxy<{ D1: D1Database }>({ persist: false })
    first = await runInternalMigrate(proxy.env.D1, consoleLogger, { provisionAll: true, baseline: false })
    second = await runInternalMigrate(proxy.env.D1, consoleLogger, { provisionAll: true, baseline: false })
  }, 300_000)

  afterAll(async () => {
    await proxy.dispose()
  })

  it('finishes both runs with zero errors', () => {
    expect(first.errorCount).toBe(0)
    expect(second.errorCount).toBe(0)
  })

  it('adds the brand voice and saved prompts columns to the integrations table', async () => {
    const columns = await columnsOf('eg_integrations')
    expect(columns).toContain('blog_brand_voice')
    expect(columns).toContain('blog_saved_prompts')
  })

  it('adds the draft key column and its index to the AI usage table', async () => {
    expect(await columnsOf('ai_builder_usage')).toContain('draft_key')
    const indexes = ((await proxy.env.D1.prepare('PRAGMA index_list(`ai_builder_usage`)').all()).results as { name: string }[]).map((i) => i.name)
    expect(indexes).toContain('ai_builder_usage_draft_key_idx')
  })

  it('is registered, after every earlier migration', async () => {
    const { migrations } = await import('@/migrations/index')
    const names = migrations.map((m) => m.name)
    const at = names.indexOf('20270128_100000_blog_builder_settings')
    expect(at).toBeGreaterThan(-1)
    expect(names.slice(at + 1).every((n) => n > '20270128_100000_blog_builder_settings')).toBe(true)
  })
})
