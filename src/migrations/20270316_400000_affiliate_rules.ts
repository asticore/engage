import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 31b rules: a commission rate override per affiliate, a minimum payout and a first-order-only rule in the
 * affiliate settings, and the buyer's email on each commission (for the first-order-only rule). The affiliate tables
 * exist only once the Affiliates section has been switched on, so each step is skipped when its table is not there
 * yet. Idempotent. Down is a no-op.
 */
const STEPS: Array<{ table: string; column: string; ddl: string }> = [
  { table: 'eg_affiliates', column: 'rate_pct', ddl: 'ALTER TABLE `eg_affiliates` ADD COLUMN `rate_pct` real' },
  { table: 'eg_affiliate_settings', column: 'min_payout_cents', ddl: 'ALTER TABLE `eg_affiliate_settings` ADD COLUMN `min_payout_cents` integer NOT NULL DEFAULT 0' },
  { table: 'eg_affiliate_settings', column: 'first_order_only', ddl: 'ALTER TABLE `eg_affiliate_settings` ADD COLUMN `first_order_only` integer NOT NULL DEFAULT 0' },
  { table: 'eg_affiliate_commissions', column: 'customer_email', ddl: "ALTER TABLE `eg_affiliate_commissions` ADD COLUMN `customer_email` text NOT NULL DEFAULT ''" },
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const step of STEPS) {
    const tables = (await db.all(sql.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name='${step.table}'`))) as { name: string }[]
    if (tables.length === 0) continue
    const existing = (await db.all(sql.raw(`PRAGMA table_info(\`${step.table}\`)`))) as { name: string }[]
    if (!existing.some((c) => c.name === step.column)) await db.run(sql.raw(step.ddl))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The columns stay on rollback.
}
