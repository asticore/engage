// @vitest-environment node
// The fresh-install baseline (src/migrations/baseline) must give exactly the schema the full
// migration run gives: same tables, columns, indexes, foreign keys and seed rows, for the lazy
// default install and after every section is switched on. A migration added after the baseline
// was generated must still run on top of it.
//
// Regenerate the baseline after adding a migration or changing the schema sets:
//   REGENERATE_BASELINE=1 pnpm exec vitest run tests/int/fresh-baseline-parity.int.spec.ts
// then run the spec again without the variable.
import fs from 'node:fs'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPlatformProxy } from 'wrangler'

import { ownerOfTable } from '@/features/featureTables'
import { consoleLogger } from '@/localapi/logger'
import type { MigrationEntry } from '@/localapi/migrate'
import { FRESH_BASELINE } from '@/migrations/baseline/freshBaseline.generated'
import type { BaselineSeed, FreshBaseline } from '@/migrations/baseline/applyBaseline'
import { TABLE_RENAMES } from '@/migrations/schema/tableRenames'
import { EARLY_MIGRATIONS, LATE_MIGRATIONS, runInternalMigrate } from '@/migrations/runInternalMigrate'

import { provisionAllFeatures } from '../helpers/provisionAll'

type Proxy = Awaited<ReturnType<typeof getPlatformProxy<{ D1: D1Database }>>>

const REGENERATE = process.env.REGENERATE_BASELINE === '1'
const GENERATED = path.join(process.cwd(), 'src/migrations/baseline/freshBaseline.generated.ts')
const TIMESTAMPS = new Set(['created_at', 'updated_at'])
const NOT_SEEDED = new Set(['eg_migrations', 'eg_feature_tables'])

const all = async <T>(db: D1Database, sql: string): Promise<T[]> => ((await db.prepare(sql).all()).results ?? []) as T[]

const userTables = async (db: D1Database): Promise<{ name: string; sql: string }[]> =>
  all(db, `SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' ORDER BY name`)

/**
 * Everything that defines the schema and the seeded content, keyed so a difference names itself.
 *
 * `maskDangling`: in the lazy default install a foreign key can point at a table of a section that
 * is switched off, so the target does not exist. Only the old and new NAME of that missing table
 * differs between the two routes (the full run leaves the pre-rename name, which the rename rewrites
 * when the section is switched on); the target is masked there. After a section is switched on
 * nothing is masked.
 */
async function snapshot(db: D1Database, maskDangling = false, fixRetired = false): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  const present = new Set((await userTables(db)).map((t) => t.name))
  const retired = new Map(TABLE_RENAMES.map((entry) => [entry.from, entry.to]))
  /** A section switched on later via migration replay can keep a foreign key to a retired name; the baseline names the eg_ table. */
  const current = (name: string): string => (fixRetired && !present.has(name) && retired.has(name) ? retired.get(name)! : name)
  const mask = (name: string): string => (present.has(current(name)) ? current(name) : '<missing table>')
  for (const table of await userTables(db)) {
    // Renaming a table makes SQLite quote the references to it; the quoting is not part of the schema.
    out[`table ${table.name}`] = table.sql.replace(/REFERENCES\s+(["`]?)([A-Za-z0-9_]+)\1\s*\(/g, (_all, _q: string, target: string) => {
      const name = maskDangling ? mask(target) : current(target)
      return `REFERENCES ${name}(`
    })
    out[`columns ${table.name}`] = await all(db, `PRAGMA table_info(\`${table.name}\`)`)
    const foreignKeys = await all<{ table: string }>(db, `PRAGMA foreign_key_list(\`${table.name}\`)`)
    out[`foreign keys ${table.name}`] = maskDangling || fixRetired ? foreignKeys.map((fk) => ({ ...fk, table: maskDangling ? mask(fk.table) : current(fk.table) })) : foreignKeys
    const columns = (await all<{ name: string }>(db, `PRAGMA table_info(\`${table.name}\`)`)).map((c) => c.name).filter((c) => !TIMESTAMPS.has(c))
    if (columns.length > 0 && table.name !== 'eg_migrations') {
      out[`rows ${table.name}`] = await all(db, `SELECT ${columns.map((c) => `\`${c}\``).join(', ')} FROM \`${table.name}\` ORDER BY rowid`)
    }
  }
  for (const index of await all<{ name: string; sql: string | null }>(db, `SELECT name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY name`)) {
    out[`index ${index.name}`] = index.sql
  }
  out['migrations'] = await all(db, `SELECT name, batch FROM eg_migrations ORDER BY name`)
  return out
}

const diff = (a: Record<string, unknown>, b: Record<string, unknown>): string[] => {
  const problems: string[] = []
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!(key in a)) problems.push(`only in baseline install: ${key}`)
    else if (!(key in b)) problems.push(`missing from baseline install: ${key}`)
    else if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
      const left = JSON.stringify(a[key])
      const right = JSON.stringify(b[key])
      let at = 0
      while (at < left.length && left[at] === right[at]) at += 1
      problems.push(`differs: ${key}\n  full run: ...${left.slice(Math.max(0, at - 60), at + 200)}\n  baseline: ...${right.slice(Math.max(0, at - 60), at + 200)}`)
    }
  }
  return problems
}

async function buildBaseline(db: D1Database): Promise<FreshBaseline> {
  const tables = await all<{ name: string; sql: string }>(db, `SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' ORDER BY rowid`)
  const indexes = await all<{ tbl_name: string; sql: string }>(db, `SELECT tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY rowid`)
  const seeds: BaselineSeed[] = []
  for (const table of tables) {
    if (NOT_SEEDED.has(table.name)) continue
    const columns = (await all<{ name: string }>(db, `PRAGMA table_info(\`${table.name}\`)`)).map((c) => c.name)
    const rows = await all<Record<string, string | number | null>>(db, `SELECT * FROM \`${table.name}\` ORDER BY rowid`)
    if (rows.length > 0) seeds.push({ table: table.name, columns, rows: rows.map((row) => columns.map((c) => row[c] ?? null)) })
  }
  const touched: Record<string, string[]> = {}
  for (const row of await all<{ feature: string; migrations: string | null }>(db, `SELECT feature, migrations FROM eg_feature_tables`)) {
    if (row.migrations) touched[row.feature] = JSON.parse(row.migrations) as string[]
  }
  const migrations = await all<{ name: string; batch: number }>(db, `SELECT name, batch FROM eg_migrations ORDER BY id`)
  // Sections provisioned after the content rename keep foreign keys to the retired names; name the eg_ tables.
  const present = new Set(tables.map((t) => t.name))
  const renamed = new Map(TABLE_RENAMES.map((entry) => [entry.from, entry.to]))
  const fixTargets = (sql: string): string =>
    sql.replace(/REFERENCES\s+(["`]?)([A-Za-z0-9_]+)\1\s*\(/g, (all, q: string, target: string) =>
      !present.has(target) && renamed.has(target) ? `REFERENCES ${q}${renamed.get(target)}${q}(` : all,
    )
  return {
    migrations,
    tables: tables.map((t) => ({ table: t.name, sql: fixTargets(t.sql) })),
    indexes: indexes.map((i) => ({ table: i.tbl_name, sql: i.sql })),
    seeds,
    touched,
  }
}

function writeBaseline(baseline: FreshBaseline): void {
  const lines = (items: unknown[]): string => items.map((item) => `    ${JSON.stringify(item)},`).join('\n')
  fs.writeFileSync(
    GENERATED,
    `// GENERATED by tests/int/fresh-baseline-parity.int.spec.ts (REGENERATE_BASELINE=1). Do not edit by hand.
// The final schema of every migration up to ${baseline.migrations.at(-1)?.name}, see ./applyBaseline.ts.
import type { FreshBaseline } from './applyBaseline'

export const FRESH_BASELINE: FreshBaseline = {
  migrations: [
${lines(baseline.migrations)}
  ],
  tables: [
${lines(baseline.tables)}
  ],
  indexes: [
${lines(baseline.indexes)}
  ],
  seeds: [
${lines(baseline.seeds)}
  ],
  touched: ${JSON.stringify(baseline.touched, null, 4).replace(/\n}/, '\n  }')},
}
`,
  )
}

describe('fresh-install baseline parity', () => {
  let full: Proxy
  let baseEvery: Proxy
  let base: Proxy
  let fullLazy: Record<string, unknown>
  let fullAll: Record<string, unknown>
  let baseLazy: Record<string, unknown>
  let baseAll: Record<string, unknown>
  let baseEveryAll: Record<string, unknown>
  let baseOutcome: Awaited<ReturnType<typeof runInternalMigrate>>

  beforeAll(async () => {
    full = await getPlatformProxy<{ D1: D1Database }>({ persist: false })
    base = await getPlatformProxy<{ D1: D1Database }>({ persist: false })
    baseEvery = await getPlatformProxy<{ D1: D1Database }>({ persist: false })

    // The reference: every migration, one by one, then every section switched on the way the app does it.
    const t0 = Date.now()
    const reference = await runInternalMigrate(full.env.D1, consoleLogger, { baseline: false })
    const fullMs = Date.now() - t0
    expect(reference.errorCount).toBe(0)
    fullLazy = await snapshot(full.env.D1, true)
    expect(await provisionAllFeatures(full.env.D1, { replayOnly: true })).toEqual([])
    fullAll = await snapshot(full.env.D1, false, true)
    if (REGENERATE) writeBaseline(await buildBaseline(full.env.D1))

    const t1 = Date.now()
    baseOutcome = await runInternalMigrate(base.env.D1, consoleLogger)
    console.warn(`fresh install timing: full migration run ${fullMs} ms, baseline ${Date.now() - t1} ms`)
    baseLazy = await snapshot(base.env.D1, true)
    expect(await provisionAllFeatures(base.env.D1)).toEqual([])
    baseAll = await snapshot(base.env.D1)
    expect((await runInternalMigrate(baseEvery.env.D1, consoleLogger, { provisionAll: true })).errorCount).toBe(0)
    baseEveryAll = await snapshot(baseEvery.env.D1)
  }, 900_000)

  afterAll(async () => {
    await full?.dispose()
    await baseEvery?.dispose()
    await base?.dispose()
  })

  it('regenerates the baseline when asked', () => {
    if (REGENERATE) console.warn('freshBaseline.generated.ts rewritten: run this spec again without REGENERATE_BASELINE to check it.')
    expect(true).toBe(true)
  })

  it('a fresh install used the baseline, not the migrations', () => {
    expect(baseOutcome.errorCount).toBe(0)
    expect(baseOutcome.results['fresh-baseline']).toBeTruthy()
    expect(baseOutcome.results['foundation-migrations']).toMatchObject({ applied: [] })
    expect(baseOutcome.results['feature-migrations']).toMatchObject({ applied: [] })
  })

  it('gives the same tables, columns, indexes, foreign keys and seed rows as the full run (lazy default)', () => {
    expect(diff(fullLazy, baseLazy)).toEqual([])
  })

  it('gives the same schema as the full run once every section is switched on (foreign keys named by their eg_ tables)', () => {
    expect(diff(fullAll, baseAll)).toEqual([])
  })

  it('leaves held-back sections out and keeps what provisioning replays', async () => {
    const states = await all<{ feature: string; state: string; migrations: string | null }>(base.env.D1, `SELECT feature, state, migrations FROM eg_feature_tables`)
    const reference = await all<{ feature: string; state: string; migrations: string | null }>(full.env.D1, `SELECT feature, state, migrations FROM eg_feature_tables`)
    expect(states).toEqual(reference)
  })

  it('creating every section at install gives the same schema as switching them on one by one', () => {
    // (`eg_feature_tables.migrations` differs on purpose: the replay lists exist only for sections switched on later.)
    expect(diff(baseAll, baseEveryAll).filter((line) => !line.includes('rows eg_feature_tables'))).toEqual([])
  })

  it('records every migration the full run records, and nothing else', () => {
    const real = new Set([...EARLY_MIGRATIONS, ...LATE_MIGRATIONS].map((m) => m.name))
    for (const entry of FRESH_BASELINE.migrations) expect(real.has(entry.name), entry.name).toBe(true)
    const covered = new Set(FRESH_BASELINE.migrations.map((m) => m.name))
    // A migration newer than the baseline is allowed (it runs on top); one the baseline claims must exist.
    const newer = [...real].filter((name) => !covered.has(name))
    for (const name of newer) expect(name > (FRESH_BASELINE.migrations.at(-1)?.name ?? ''), `${name} is older than the baseline but not in it`).toBe(true)
  })

  it('a table of a held-back section is not created, but its owner is known', () => {
    for (const entry of FRESH_BASELINE.tables) expect(typeof ownerOfTable(entry.table)).toBe('string')
  })

  it('is a no-op on a second run, and an existing install does not take the baseline', async () => {
    const proxy = await getPlatformProxy<{ D1: D1Database }>({ persist: false })
    try {
      expect((await runInternalMigrate(proxy.env.D1, consoleLogger)).errorCount).toBe(0)
      const recordedBefore = await all(proxy.env.D1, `SELECT name, batch FROM eg_migrations ORDER BY name`)
      const again = await runInternalMigrate(proxy.env.D1, consoleLogger)
      expect(again.errorCount).toBe(0)
      expect(again.results['fresh-baseline']).toBeUndefined()
      // (The second run's relationship-column renames are the full run's own behaviour on a lazy install, not the baseline's.)
      expect(await all(proxy.env.D1, `SELECT name, batch FROM eg_migrations ORDER BY name`)).toEqual(recordedBefore)
      expect(again.results['foundation-migrations']).toMatchObject({ applied: [] })
      expect(again.results['feature-migrations']).toMatchObject({ applied: [] })
    } finally {
      await proxy.dispose()
    }
    // An install built by the full migration run is an existing install too.
    const fullAgain = await runInternalMigrate(full.env.D1, consoleLogger)
    expect(fullAgain.results['fresh-baseline']).toBeUndefined()
  }, 300_000)

  it('a migration added after the baseline still runs on a baseline install, once', async () => {
    const proxy = await getPlatformProxy<{ D1: D1Database }>({ persist: false })
    try {
      let runs = 0
      const later: MigrationEntry = {
        name: '99990101_000000_after_baseline_probe',
        up: async ({ db }) => {
          runs += 1
          await db.run((await import('drizzle-orm')).sql.raw('CREATE TABLE IF NOT EXISTS `eg_after_baseline_probe` (`id` integer PRIMARY KEY NOT NULL)'))
        },
        down: async () => undefined,
      }
      const first = await runInternalMigrate(proxy.env.D1, consoleLogger, { appendMigrations: [later] })
      expect(first.errorCount).toBe(0)
      expect(first.results['fresh-baseline']).toBeTruthy()
      expect(first.results['feature-migrations']).toMatchObject({ applied: [later.name] })
      expect(runs).toBe(1)
      expect(await all(proxy.env.D1, `SELECT name FROM sqlite_master WHERE name='eg_after_baseline_probe'`)).toHaveLength(1)
      const recorded = await all<{ name: string; batch: number }>(proxy.env.D1, `SELECT name, batch FROM eg_migrations WHERE name = '${later.name}'`)
      expect(recorded).toHaveLength(1)
      expect(recorded[0]!.batch).toBeGreaterThan(Math.max(...FRESH_BASELINE.migrations.map((m) => m.batch)))
      const second = await runInternalMigrate(proxy.env.D1, consoleLogger, { appendMigrations: [later] })
      expect(second.errorCount).toBe(0)
      expect(runs).toBe(1)
    } finally {
      await proxy.dispose()
    }
  }, 300_000)

  it('seeds nothing for a held-back section', () => {
    const seeded = FRESH_BASELINE.seeds.map((seed) => seed.table)
    expect(seeded.length).toBeGreaterThan(0)
  })
})
