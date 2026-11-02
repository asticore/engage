/**
 * Fresh-install fast path.
 *
 * Running the ~140 migrations one by one on an empty database is slow because
 * almost every one of them first looks at the schema (table and column
 * existence checks) before it changes anything. The RESULT of all of them is
 * fixed, so a fresh install applies it directly: `freshBaseline.generated.ts`
 * holds the final DDL (tables, then indexes) plus the few seed rows the
 * migrations write, and the names of every migration it stands for. They are
 * recorded in `eg_migrations` as already run, so only migrations added AFTER
 * the baseline was generated run afterwards, exactly as on any other install.
 *
 * Existing databases never take this path (see `baselineEligible`), and
 * lazy provisioning is unchanged: statements for the tables of a feature that
 * is held back are left out here, and the migrations that touched them are
 * stored so switching the feature on replays them as before.
 *
 * `tests/int/fresh-baseline-parity.int.spec.ts` proves the baseline gives the
 * same tables, columns, indexes, foreign keys and seed rows as the full
 * migration run, and regenerates the file (`REGENERATE_BASELINE=1`).
 */
import { ownerOfTable } from '@/features/featureTables'
import type { FeatureKey } from '@/features/registry'

import { FRESH_BASELINE } from './freshBaseline.generated'

export type BaselineSeed = { table: string; columns: string[]; rows: (string | number | null)[][] }

export type FreshBaseline = {
  /** Every migration the baseline stands for, with the batch the full run recorded it under. */
  migrations: { name: string; batch: number }[]
  tables: { table: string; sql: string }[]
  indexes: { table: string; sql: string }[]
  seeds: BaselineSeed[]
  /** Migrations that touched each lazily provisioned feature (what provisioning replays). */
  touched: Record<string, string[]>
}

const STATEMENTS_PER_BATCH = 100

/** `CREATE TABLE x` becomes `CREATE TABLE IF NOT EXISTS x`, so a retry after an interrupted run is safe. */
export function idempotent(sql: string): string {
  return sql.replace(/^CREATE (UNIQUE )?(TABLE|INDEX) (?!IF NOT EXISTS)/i, (_all, unique: string | undefined, kind: string) => `CREATE ${unique ?? ''}${kind} IF NOT EXISTS `)
}

/** Tables the baseline skips because the engine creates them itself, or the install fills them in. */
const SKIP_SEEDS = new Set(['eg_migrations', 'eg_feature_tables'])

/**
 * True when the baseline may be used: no migration has ever been recorded.
 * `freshStart` is the caller's own check that nothing exists yet; `resuming`
 * covers a first install that stopped half way (its feature record exists but
 * no migration was recorded). Anything else is an existing install.
 */
export async function baselineEligible(db: D1Database, flags: { freshStart: boolean; resuming: boolean }): Promise<boolean> {
  if (!flags.freshStart && !flags.resuming) return false
  const table = await db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_migrations'`).all()
  if ((table.results?.length ?? 0) === 0) return true
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM eg_migrations`).first<{ n: number }>()
  return !row || row.n === 0
}

async function runBatched(db: D1Database, statements: D1PreparedStatement[]): Promise<void> {
  for (let i = 0; i < statements.length; i += STATEMENTS_PER_BATCH) {
    await db.batch(statements.slice(i, i + STATEMENTS_PER_BATCH))
  }
}

export type ApplyBaselineResult = { tables: number; indexes: number; seeds: number; migrations: number }

/**
 * Creates the final schema (leaving out the tables of `deferred` features),
 * the seed rows, and the migration records. The migrations are recorded last,
 * so an interrupted run is eligible again and simply repeats this.
 */
export async function applyFreshBaseline(
  db: D1Database,
  deferred: Set<FeatureKey>,
  baseline: FreshBaseline = FRESH_BASELINE,
): Promise<ApplyBaselineResult> {
  const wanted = (table: string): boolean => {
    const owner = ownerOfTable(table)
    return owner === 'core' || !deferred.has(owner)
  }
  const tables = baseline.tables.filter((entry) => wanted(entry.table))
  const indexes = baseline.indexes.filter((entry) => wanted(entry.table))
  await runBatched(db, tables.map((entry) => db.prepare(idempotent(entry.sql))))
  await runBatched(db, indexes.map((entry) => db.prepare(idempotent(entry.sql))))

  const now = new Date().toISOString()
  const inserts: D1PreparedStatement[] = []
  let seeds = 0
  for (const seed of baseline.seeds) {
    if (SKIP_SEEDS.has(seed.table) || !wanted(seed.table)) continue
    const cols = seed.columns.map((c) => `\`${c}\``).join(', ')
    const marks = seed.columns.map(() => '?').join(', ')
    const statement = db.prepare(`INSERT OR IGNORE INTO \`${seed.table}\` (${cols}) VALUES (${marks})`)
    for (const row of seed.rows) {
      inserts.push(statement.bind(...row.map((value, index) => (seed.columns[index] === 'created_at' || seed.columns[index] === 'updated_at' ? now : value))))
      seeds += 1
    }
  }
  await runBatched(db, inserts)

  // What provisioning a held-back feature replays later.
  const touchedWrites: D1PreparedStatement[] = []
  for (const feature of deferred) {
    const names = baseline.touched[feature]
    if (names?.length) {
      touchedWrites.push(db.prepare(`UPDATE eg_feature_tables SET migrations = ? WHERE feature = ?`).bind(JSON.stringify([...names].sort()), feature))
    }
  }
  await runBatched(db, touchedWrites)

  // One batch (one transaction): either every migration is recorded or none is.
  await db.batch(
    baseline.migrations.map((entry) =>
      db.prepare(`INSERT INTO eg_migrations (name, batch, updated_at, created_at) VALUES (?, ?, ?, ?)`).bind(entry.name, entry.batch, now, now),
    ),
  )
  return { tables: tables.length, indexes: indexes.length, seeds, migrations: baseline.migrations.length }
}
