import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 26b and 26a (affiliates): payout details an affiliate adds themselves (a text column on the affiliate row) and a
 * daily count of crawler and script hits that were ignored (new table). The affiliate tables exist only once the Affiliates
 * section has been switched on, so the column step is skipped when its table is not there yet. Idempotent. Down is a no-op.
 */
export const AFFILIATE_BOT_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_affiliate_bot_hits\` (
  \`day\` text PRIMARY KEY NOT NULL,
  \`hits\` integer NOT NULL DEFAULT 0
)`,
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of AFFILIATE_BOT_STATEMENTS) await db.run(sql.raw(statement))
  const tables = (await db.all(sql.raw("SELECT name FROM sqlite_master WHERE type='table' AND name='eg_affiliates'"))) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_affiliates`)'))) as { name: string }[]
  if (!existing.some((c) => c.name === 'payout_details')) await db.run(sql.raw("ALTER TABLE `eg_affiliates` ADD COLUMN `payout_details` text NOT NULL DEFAULT ''"))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The table and column stay on rollback.
}
