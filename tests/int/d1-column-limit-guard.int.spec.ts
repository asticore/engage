// @vitest-environment node
// D1 caps a table at 100 columns. A feature that pushes a table over fails the fresh install,
// which broke main once (`_eg_products_v`, 17 Nov 2026). This guard fails in the PR instead:
// no table may come within 5 columns of the cap, and the tables already near it may not grow.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPlatformProxy } from 'wrangler'

import { consoleLogger } from '@/localapi/logger'
import { runInternalMigrate } from '@/migrations/runInternalMigrate'

const D1_COLUMN_LIMIT = 100
const WARN_MARGIN = 5

/** Tables already within the margin, with the most columns each may have. Never raise a number: move new fields into a JSON column or a new table. */
const NEAR_LIMIT: Record<string, number> = {
  eg_integrations: 97,
  eg_shop_settings: 100,
  eg_security_settings: 100,
  _eg_products_v: 99,
}

describe('D1 100-column limit guard', () => {
  let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ D1: D1Database }>>>
  const counts: Record<string, number> = {}

  beforeAll(async () => {
    proxy = await getPlatformProxy<{ D1: D1Database }>({ persist: false })
    await runInternalMigrate(proxy.env.D1, consoleLogger, { provisionAll: true })
    const rows = await proxy.env.D1.prepare(`SELECT name FROM sqlite_master WHERE type='table' `).all()
    for (const { name } of rows.results as { name: string }[]) {
      if (name.startsWith('_cf_')) continue
      const info = await proxy.env.D1.prepare(`PRAGMA table_info("${name.replace(/"/g, '""')}")`).all()
      counts[name] = info.results.length
    }
  }, 280000)

  afterAll(async () => {
    await proxy?.dispose()
  })

  it('no table is within 5 columns of the limit unless it is listed', () => {
    const risky = Object.entries(counts)
      .filter(([name, n]) => n > D1_COLUMN_LIMIT - WARN_MARGIN && !(name in NEAR_LIMIT))
      .map(([name, n]) => `${name}: ${n} of ${D1_COLUMN_LIMIT}`)
    expect(risky, 'Add fields as a JSON column or a new table instead of widening a nearly full table').toEqual([])
  })

  it('listed tables do not grow, and leave the list when they shrink', () => {
    const problems: string[] = []
    for (const [name, max] of Object.entries(NEAR_LIMIT)) {
      const n = counts[name]
      if (n === undefined) problems.push(`${name} no longer exists: remove it from NEAR_LIMIT`)
      else if (n > max) problems.push(`${name} grew from ${max} to ${n} columns`)
      else if (n <= D1_COLUMN_LIMIT - WARN_MARGIN) problems.push(`${name} is down to ${n}: remove it from NEAR_LIMIT`)
    }
    expect(problems).toEqual([])
  })

  it('no table is over the limit', () => {
    expect(Object.entries(counts).filter(([, n]) => n > D1_COLUMN_LIMIT)).toEqual([])
  })
})
