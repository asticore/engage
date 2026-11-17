import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 26c (affiliates): a flag on each commission saying the "now payable" email has been sent, so the daily job sends it once.
 * Commissions that are already past their waiting period are marked as sent, so turning this on does not email old ones.
 * The affiliate tables exist only once the Affiliates section has been switched on, so the step is skipped when the table is
 * not there yet. Idempotent. Down is a no-op.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const tables = (await db.all(sql.raw("SELECT name FROM sqlite_master WHERE type='table' AND name='eg_affiliate_commissions'"))) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_affiliate_commissions`)'))) as { name: string }[]
  if (existing.some((c) => c.name === 'payable_notified')) return
  await db.run(sql.raw('ALTER TABLE `eg_affiliate_commissions` ADD COLUMN `payable_notified` integer NOT NULL DEFAULT 0'))
  await db.run(sql.raw("UPDATE `eg_affiliate_commissions` SET `payable_notified` = 1 WHERE `status` != 'pending' OR `eligible_at` IS NULL OR `eligible_at` <= strftime('%Y-%m-%dT%H:%M:%fZ','now')"))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The column stays on rollback.
}
