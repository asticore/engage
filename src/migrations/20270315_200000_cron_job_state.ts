import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

// Task 7: `eg_cron_job_state` holds which scheduled jobs an admin switched off on the Scheduled tasks screen.
// One row per job that was ever toggled; a job with no row is on. Written with raw SQL by
// src/features/cron/jobState.ts (column names are the ones that file uses; change one, change both).
// Idempotent: CREATE ... IF NOT EXISTS.

const TABLE = `CREATE TABLE IF NOT EXISTS \`eg_cron_job_state\` (
  \`job\` text PRIMARY KEY NOT NULL,
  \`enabled\` integer DEFAULT 1 NOT NULL,
  \`updated_at\` text NOT NULL
)`

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  await db.run(sql.raw(TABLE))
  engine.logger.info('[migrate] eg_cron_job_state is present.')
}

export async function down({ engine }: MigrateDownArgs): Promise<void> {
  engine.logger.info('[migrate] Down is a no-op - eg_cron_job_state is left in place.')
}
