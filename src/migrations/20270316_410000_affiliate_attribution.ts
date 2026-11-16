import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 31a: coupon-code attribution (a coupon code per affiliate), the consent category the referral cookie is stored
 * under, and the UTM values and attribution source kept on each commission. The affiliate tables exist only once the
 * Affiliates section has been switched on, so each step is skipped when its table is not there yet. Idempotent. Down is a no-op.
 */
const STEPS: Array<{ table: string; column: string; ddl: string }> = [
  { table: 'eg_affiliates', column: 'coupon_code', ddl: "ALTER TABLE `eg_affiliates` ADD COLUMN `coupon_code` text NOT NULL DEFAULT ''" },
  { table: 'eg_affiliate_settings', column: 'consent_category', ddl: "ALTER TABLE `eg_affiliate_settings` ADD COLUMN `consent_category` text NOT NULL DEFAULT 'necessary'" },
  { table: 'eg_affiliate_commissions', column: 'utm_source', ddl: "ALTER TABLE `eg_affiliate_commissions` ADD COLUMN `utm_source` text NOT NULL DEFAULT ''" },
  { table: 'eg_affiliate_commissions', column: 'utm_medium', ddl: "ALTER TABLE `eg_affiliate_commissions` ADD COLUMN `utm_medium` text NOT NULL DEFAULT ''" },
  { table: 'eg_affiliate_commissions', column: 'utm_campaign', ddl: "ALTER TABLE `eg_affiliate_commissions` ADD COLUMN `utm_campaign` text NOT NULL DEFAULT ''" },
  { table: 'eg_affiliate_commissions', column: 'source', ddl: "ALTER TABLE `eg_affiliate_commissions` ADD COLUMN `source` text NOT NULL DEFAULT 'link'" },
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
