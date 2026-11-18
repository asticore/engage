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

