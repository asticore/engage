/**
 * The record of which features have their tables.
 *
 * `eg_feature_tables` has one row per feature that owns tables:
 *   - `provisioned`: the tables exist (every install that predates lazy
 *     provisioning has all of them, so the migration marks them all).
 *   - `deferred`:    a fresh install left them out; switching the feature on
 *     creates them (see ../provisioning.ts).
 *
 * A feature without a row is treated as provisioned: that is what an install
 * from before this table existed looks like, and it keeps migrations that add
 * tables for a NEW feature creating them as they always did.
 */

import { DEFERRED_ON_FRESH_INSTALL, FEATURES_WITH_TABLES } from '@/features/featureTables'
import type { FeatureKey } from '@/features/registry'

export const FEATURE_TABLES_TABLE = 'eg_feature_tables'

export const FEATURE_TABLES_DDL = `CREATE TABLE IF NOT EXISTS \`${FEATURE_TABLES_TABLE}\` (
  \`feature\` text PRIMARY KEY NOT NULL,
  \`state\` text NOT NULL,
  \`updated_at\` text NOT NULL,
  \`migrations\` text
)`

export type FeatureTableState = 'provisioned' | 'deferred'

type Raw = Pick<D1Database, 'prepare'>

export async function stateTableExists(db: Raw): Promise<boolean> {
  const result = await db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).bind(FEATURE_TABLES_TABLE).all()
  return (result.results?.length ?? 0) > 0
}

/** Features whose tables are held back. Empty when the state table does not exist. */
export async function readDeferredFeatures(db: Raw): Promise<Set<FeatureKey>> {
  if (!(await stateTableExists(db))) return new Set()
  const result = await db.prepare(`SELECT feature FROM ${FEATURE_TABLES_TABLE} WHERE state = 'deferred'`).all()
  return new Set((result.results as { feature: FeatureKey }[]).map((row) => row.feature))
}

export async function setFeatureState(db: Raw, feature: FeatureKey, state: FeatureTableState): Promise<void> {
  const now = new Date().toISOString()
  await db
    .prepare(
      `INSERT INTO ${FEATURE_TABLES_TABLE} (feature, state, updated_at) VALUES (?, ?, ?) ON CONFLICT(feature) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
    )
    .bind(feature, state, now)
    .run()
}

/**
 * Writes the starting state of a fresh install: tables of features that are on
 * by default are provisioned, the rest deferred. `provisionAll` (tests, and
 * anyone who wants the old everything-at-once install) marks them all provisioned.
 */
export async function initialiseFreshState(db: Raw, provisionAll: boolean): Promise<void> {
  await db.prepare(FEATURE_TABLES_DDL).run()
  for (const feature of FEATURES_WITH_TABLES) {
    const deferred = !provisionAll && DEFERRED_ON_FRESH_INSTALL.includes(feature)
    await setFeatureState(db, feature, deferred ? 'deferred' : 'provisioned')
  }
}

/** Reads the state of every feature that owns tables. A feature with no row is provisioned. */
export async function readFeatureTableStates(db: Raw): Promise<Record<string, FeatureTableState>> {
  const out: Record<string, FeatureTableState> = {}
  for (const feature of FEATURES_WITH_TABLES) out[feature] = 'provisioned'
  if (!(await stateTableExists(db))) return out
  const result = await db.prepare(`SELECT feature, state FROM ${FEATURE_TABLES_TABLE}`).all()
  for (const row of result.results as { feature: string; state: FeatureTableState }[]) out[row.feature] = row.state
  return out
}

/**
 * Adds the migrations that touched each held-back feature to its row (a JSON
 * array of names, kept sorted). Provisioning replays only these.
 */
export async function recordTouchedMigrations(db: Raw, touched: Map<FeatureKey, Set<string>>): Promise<void> {
  for (const [feature, names] of touched) {
    const row = await db.prepare(`SELECT migrations FROM ${FEATURE_TABLES_TABLE} WHERE feature = ?`).bind(feature).first<{ migrations: string | null }>()
    if (!row) continue
    const merged = new Set<string>(row.migrations ? (JSON.parse(row.migrations) as string[]) : [])
    for (const name of names) merged.add(name)
    await db
      .prepare(`UPDATE ${FEATURE_TABLES_TABLE} SET migrations = ? WHERE feature = ?`)
      .bind(JSON.stringify([...merged].sort()), feature)
      .run()
  }
}

/** The migrations to replay for a feature, or null when none were recorded (replay all of them). */
export async function readTouchedMigrations(db: Raw, feature: FeatureKey): Promise<Set<string> | null> {
  if (!(await stateTableExists(db))) return null
  const row = await db.prepare(`SELECT migrations FROM ${FEATURE_TABLES_TABLE} WHERE feature = ?`).bind(feature).first<{ migrations: string | null }>()
  if (!row?.migrations) return null
  return new Set(JSON.parse(row.migrations) as string[])
}
