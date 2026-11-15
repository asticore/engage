import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 16e: product feeds as records. One row per feed: channel, secret address token, currency, price tier,
 * category and tag filters. Owned by the shop section (created when the shop is switched on). Idempotent. Down is a no-op.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(
    sql.raw(`CREATE TABLE IF NOT EXISTS \`eg_product_feeds\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`name\` text NOT NULL,
  \`channel\` text NOT NULL,
  \`token\` text NOT NULL,
  \`currency\` text NOT NULL DEFAULT '',
  \`price_tier\` text NOT NULL DEFAULT '',
  \`category\` text NOT NULL DEFAULT '',
  \`tag\` text NOT NULL DEFAULT '',
  \`include_out_of_stock\` integer NOT NULL DEFAULT 0,
  \`enabled\` integer NOT NULL DEFAULT 1,
  \`updated_at\` text,
  \`created_at\` text
)`),
  )
  await db.run(sql.raw('CREATE UNIQUE INDEX IF NOT EXISTS `eg_product_feeds_token_idx` ON `eg_product_feeds` (`token`)'))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The table stays on rollback.
}
