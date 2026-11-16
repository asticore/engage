import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 31a settings and 31b commissions. Tables owned by the `affiliates` feature (created only when the section is
 * switched on, see src/features/registry.ts). Idempotent. Down is a no-op.
 */
export const AFFILIATE_COMMISSION_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_affiliate_settings\` (
  \`id\` integer PRIMARY KEY NOT NULL,
  \`cookie_days\` integer NOT NULL DEFAULT 30,
  \`click_rule\` text NOT NULL DEFAULT 'last',
  \`commission_pct\` real NOT NULL DEFAULT 10,
  \`pending_days\` integer NOT NULL DEFAULT 30,
  \`updated_at\` text
)`,
  `CREATE TABLE IF NOT EXISTS \`eg_affiliate_commissions\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`affiliate_id\` integer NOT NULL,
  \`order_id\` integer NOT NULL,
  \`base_cents\` integer NOT NULL DEFAULT 0,
  \`rate_pct\` real NOT NULL DEFAULT 0,
  \`amount_cents\` integer NOT NULL DEFAULT 0,
  \`status\` text NOT NULL DEFAULT 'tracked',
  \`eligible_at\` text,
  \`payout_id\` integer,
  \`created_at\` text,
  \`updated_at\` text
)`,
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_affiliate_commissions_order_idx` ON `eg_affiliate_commissions` (`order_id`)',
  'CREATE INDEX IF NOT EXISTS `eg_affiliate_commissions_aff_idx` ON `eg_affiliate_commissions` (`affiliate_id`)',
  `CREATE TABLE IF NOT EXISTS \`eg_affiliate_payouts\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`affiliate_id\` integer NOT NULL,
  \`amount_cents\` integer NOT NULL DEFAULT 0,
  \`note\` text NOT NULL DEFAULT '',
  \`created_at\` text
)`,
  'CREATE INDEX IF NOT EXISTS `eg_affiliate_payouts_aff_idx` ON `eg_affiliate_payouts` (`affiliate_id`)',
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of AFFILIATE_COMMISSION_STATEMENTS) await db.run(sql.raw(statement))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The tables stay on rollback.
}
