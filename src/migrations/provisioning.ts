/**
 * Creates a feature's database tables on demand.
 *
 * A fresh install leaves the tables of features that are off out of the
 * database (see schema/deferredTables.ts). Switching the feature on calls
 * `provisionFeature`, which replays the same migration sequence that built the
 * rest of the schema with a filter that lets only this feature's statements
 * through, then records the feature as provisioned. Everything is idempotent
 * (`CREATE ... IF NOT EXISTS`, duplicate-column tolerant), so a failed or
 * repeated call is safe. Switching a feature off later removes nothing.
 */

import { FEATURES, type FeatureKey } from '@/features/registry'
import { FEATURES_WITH_TABLES } from '@/features/featureTables'
import type { EngineLogger } from '@/localapi/logger'

import { applyFeatureBaseline } from './baseline/applyBaseline'
import { runInternalMigrate } from './runInternalMigrate'
import { readFeatureTableStates, setFeatureState } from './schema/featureTablesState'

export type ProvisionResult = { ok: boolean; alreadyProvisioned: boolean; errors: string[] }

/** True when the feature owns tables and they have not been created yet. */
export async function isFeatureDeferred(db: D1Database, key: FeatureKey): Promise<boolean> {
  if (!FEATURES_WITH_TABLES.includes(key)) return false
  const states = await readFeatureTableStates(db)
  return states[key] === 'deferred'
}

export type ProvisionOptions = {
  /** Replay the migrations only, without creating the tables from the baseline first (how the baseline itself is generated). */
  replayOnly?: boolean
}

export async function provisionFeature(db: D1Database, logger: EngineLogger, key: FeatureKey, options: ProvisionOptions = {}): Promise<ProvisionResult> {
  if (!(await isFeatureDeferred(db, key))) return { ok: true, alreadyProvisioned: true, errors: [] }

  let fromBaseline = false
  try {
    if (!options.replayOnly) fromBaseline = (await applyFeatureBaseline(db, key)) > 0
  } catch (error) {
    return { ok: false, alreadyProvisioned: false, errors: [`Creating the ${key} tables failed: ${error instanceof Error ? error.message : String(error)}`] }
  }
  const run = await runInternalMigrate(db, logger, { onlyFeature: key, tablesFromBaseline: fromBaseline })
  if (run.errorCount > 0) {
    return { ok: false, alreadyProvisioned: false, errors: [`Creating the ${key} tables failed (${run.errorCount} error(s)); nothing was switched on.`] }
  }

  // Prove it: at least one declared base table must exist now.
  const feature = FEATURES.find((entry) => entry.key === key)
  const names = (feature?.tables ?? []).flatMap((base) => [`eg_${base}`, base])
  const marks = names.map(() => '?').join(',')
  const found = await db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name IN (${marks})`).bind(...names).all()
  if ((found.results?.length ?? 0) === 0) {
    return { ok: false, alreadyProvisioned: false, errors: [`The ${key} tables were not created.`] }
  }

  await setFeatureState(db, key, 'provisioned')
  return { ok: true, alreadyProvisioned: false, errors: [] }
}
