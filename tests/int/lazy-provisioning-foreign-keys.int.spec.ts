// @vitest-environment node
// A section switched on after a lazy install must be usable: its foreign keys name the eg_ tables
// (not the retired pre-rename names), so rows can be inserted.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPlatformProxy } from 'wrangler'

import { consoleLogger } from '@/localapi/logger'
import { provisionFeature } from '@/migrations/provisioning'
import { runInternalMigrate } from '@/migrations/runInternalMigrate'

const all = async <T>(db: D1Database, sql: string): Promise<T[]> => ((await db.prepare(sql).all()).results ?? []) as T[]

/** Inserts one row, filling only the required columns without a default. */
async function insertMinimal(db: D1Database, table: string): Promise<void> {
  const columns = await all<{ name: string; type: string; notnull: number; dflt_value: string | null; pk: number }>(db, `PRAGMA table_info(\`${table}\`)`)
  const needed = columns.filter((c) => c.notnull === 1 && c.dflt_value === null && !(c.pk === 1 && /int/i.test(c.type)))
  const names = needed.map((c) => `\`${c.name}\``).join(', ')
  const values = needed.map((c) => (/int|real|num/i.test(c.type) ? '1' : `'x'`)).join(', ')
  await db.prepare(needed.length ? `INSERT INTO \`${table}\` (${names}) VALUES (${values})` : `INSERT INTO \`${table}\` DEFAULT VALUES`).run()
}

describe('sections switched on after a lazy install', () => {
  let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ D1: D1Database }>>>
  let d1: D1Database

  beforeAll(async () => {
    proxy = await getPlatformProxy<{ D1: D1Database }>({ persist: false })
    d1 = proxy.env.D1
    expect((await runInternalMigrate(d1, consoleLogger)).errorCount).toBe(0)
    for (const key of ['blog', 'ecommerce', 'events'] as const) {
      const result = await provisionFeature(d1, consoleLogger, key)
      expect(result.errors).toEqual([])
      expect(result.ok).toBe(true)
    }
  }, 300_000)

  afterAll(async () => {
    await proxy?.dispose()
  })

  it('no table has a foreign key to a table that does not exist', async () => {
    const present = new Set((await all<{ name: string }>(d1, `SELECT name FROM sqlite_master WHERE type='table'`)).map((t) => t.name))
    const dangling: string[] = []
    for (const table of present) {
      if (/^(sqlite_|_cf_)/.test(table)) continue
      for (const fk of await all<{ table: string }>(d1, `PRAGMA foreign_key_list(\`${table}\`)`)) {
        if (!present.has(fk.table)) dangling.push(`${table} -> ${fk.table}`)
      }
    }
    // Sections still switched off may be referenced; the three switched on may not reference retired names.
    expect(dangling.filter((entry) => /-> (users|media|posts|products|events|pages|page_templates|faqs)$/.test(entry))).toEqual([])
  })

  it('a post, a product and an event can be inserted', async () => {
    for (const table of ['eg_posts', 'eg_products', 'eg_events']) {
      await insertMinimal(d1, table)
      expect((await all<{ n: number }>(d1, `SELECT COUNT(*) AS n FROM \`${table}\``))[0]!.n).toBe(1)
    }
  })

  it('a second switch-on does nothing and a re-run keeps the rows', async () => {
    expect((await provisionFeature(d1, consoleLogger, 'blog')).alreadyProvisioned).toBe(true)
    expect((await runInternalMigrate(d1, consoleLogger)).errorCount).toBe(0)
    expect((await all<{ n: number }>(d1, `SELECT COUNT(*) AS n FROM eg_posts`))[0]!.n).toBe(1)
  }, 300_000)
})
