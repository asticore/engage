import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 26b (affiliates): recurring commission on subscription renewals. Two columns on the affiliate settings row:
 * recurring (on or off) and recurring_months (how long after the first order renewals still earn, 0 for no limit).
 * The affiliate tables exist only once the Affiliates section has been switched on, so the step is skipped when the
 * table is not there yet. Idempotent. Down is a no-op.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const tables = (await db.all(sql.raw("SELECT name FROM sqlite_master WHERE type='table' AND name='eg_affiliate_settings'"))) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_affiliate_settings`)'))) as { name: string }[]
  if (!existing.some((c) => c.name === 'recurring')) await db.run(sql.raw('ALTER TABLE `eg_affiliate_settings` ADD COLUMN `recurring` integer NOT NULL DEFAULT 0'))
  if (!existing.some((c) => c.name === 'recurring_months')) await db.run(sql.raw('ALTER TABLE `eg_affiliate_settings` ADD COLUMN `recurring_months` integer NOT NULL DEFAULT 0'))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The columns stay on rollback.
}
