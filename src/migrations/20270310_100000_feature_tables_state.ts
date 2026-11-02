import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

import { FEATURES } from '@/features/registry'
import { FEATURES_WITH_TABLES } from '@/features/featureTables'

// Lazy sections: records which features have their database tables (`eg_feature_tables`).
//
// A fresh install now creates only core tables and the tables of features that are on by default;
// every other feature gets its tables the first time it is switched on (src/migrations/provisioning.ts).
// This migration is what keeps every EXISTING install exactly as it was: any feature that already has
// one of its tables (all of them, on an install from before this change) is marked `provisioned`, so
// nothing is held back and nothing disappears. The user-facing on/off switches are not touched.
//
// On a fresh install the table and its rows already exist (runInternalMigrate writes them before the
// first migration so a half-finished install resumes with the same choice); the INSERT OR IGNORE then
// leaves them alone. A feature that owns tables but has none yet is recorded `deferred`.
// Idempotent. Down is a no-op: the table is bookkeeping and is left in place.

type Runner = MigrateUpArgs['db']

const tableExists = async (db: Runner, table: string): Promise<boolean> =>
  ((await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name=${table}`)) as unknown[]).length > 0

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  await db.run(
    sql.raw(
      'CREATE TABLE IF NOT EXISTS `eg_feature_tables` (`feature` text PRIMARY KEY NOT NULL, `state` text NOT NULL, `updated_at` text NOT NULL, `migrations` text)',
    ),
  )
  const now = new Date().toISOString()
  for (const key of FEATURES_WITH_TABLES) {
    const feature = FEATURES.find((entry) => entry.key === key)
    let present = false
    for (const base of feature?.tables ?? []) {
      if ((await tableExists(db, `eg_${base}`)) || (await tableExists(db, base))) {
        present = true
        break
      }
    }
    await db.run(
      sql`INSERT OR IGNORE INTO eg_feature_tables (feature, state, updated_at) VALUES (${key}, ${present ? 'provisioned' : 'deferred'}, ${now})`,
    )
  }
  engine.logger.info('[migrate] Feature table state recorded (existing sections stay provisioned).')
}

export async function down({ engine }: MigrateDownArgs): Promise<void> {
  engine.logger.info('[migrate] Down is a no-op - the bookkeeping table is left in place.')
}
