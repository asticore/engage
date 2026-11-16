import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 26b (affiliates): commission rates per product (new table) and sales tiers (a text column on the settings row).
 * The affiliate tables exist only once the Affiliates section has been switched on, so the column step is skipped when
 * its table is not there yet. Idempotent. Down is a no-op.
 */
export const AFFILIATE_RATE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_affiliate_product_rates\` (
  \`product_id\` integer PRIMARY KEY NOT NULL,
  \`rate_pct\` real NOT NULL DEFAULT 0,
  \`updated_at\` text
)`,
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of AFFILIATE_RATE_STATEMENTS) await db.run(sql.raw(statement))
  const tables = (await db.all(sql.raw("SELECT name FROM sqlite_master WHERE type='table' AND name='eg_affiliate_settings'"))) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_affiliate_settings`)'))) as { name: string }[]
  if (!existing.some((c) => c.name === 'tiers')) await db.run(sql.raw("ALTER TABLE `eg_affiliate_settings` ADD COLUMN `tiers` text NOT NULL DEFAULT ''"))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The table and column stay on rollback.
}
