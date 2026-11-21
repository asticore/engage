import { compareVersions, parseVersion } from './versions'

/** The version the database schema has been migrated to, kept in one tiny key/value table. */

const TABLE = 'eg_engage_meta'

export async function getAppliedVersion(db: D1Database): Promise<string | null> {
  await db.exec(`CREATE TABLE IF NOT EXISTS ${TABLE} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`)
  const row = await db.prepare(`SELECT value FROM ${TABLE} WHERE key = 'applied_version'`).first<{ value: string }>()
  return row?.value ?? null
}

export async function setAppliedVersion(db: D1Database, version: string): Promise<void> {
  await db.exec(`CREATE TABLE IF NOT EXISTS ${TABLE} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`)
  await db.prepare(`INSERT INTO ${TABLE} (key, value) VALUES ('applied_version', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1`).bind(version).run()
}

/** The bar's check: has the database been migrated for the code that is running? No record counts as pending (a fresh install). */
export function isMigrationPending(applied: string | null, running: string): boolean {
  const a = parseVersion(applied)
  const r = parseVersion(running)
  if (!r) return false
  return !a || compareVersions(a, r) < 0
}


/**
 * The migrations this code would run that the database has not recorded yet. This, not the version number, decides whether an
 * admin is asked to migrate: a release with no new migration leaves the list empty, so nothing is shown. A missing history
 * table (fresh install) counts as everything pending.
 */
export async function pendingMigrationNames(db: D1Database, expected: string[]): Promise<string[]> {
  const table = await db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_migrations'`).first()
  if (!table) return expected
  const rows = await db.prepare('SELECT name FROM eg_migrations').all<{ name: string }>()
  const done = new Set((rows.results ?? []).map((r) => r.name))
  return expected.filter((name) => !done.has(name))
}
