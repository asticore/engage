import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 26a (affiliates): short links per affiliate and product (new table). A short link is a vanity code that opens a
 * product page (or the home page) with the affiliate's referral code attached. Idempotent. Down is a no-op.
 */
export const AFFILIATE_LINK_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_affiliate_links\` (
  \`code\` text PRIMARY KEY NOT NULL,
  \`affiliate_id\` integer NOT NULL,
  \`product_id\` integer,
  \`created_at\` text
)`,
  'CREATE INDEX IF NOT EXISTS `eg_affiliate_links_affiliate_idx` ON `eg_affiliate_links` (`affiliate_id`)',
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of AFFILIATE_LINK_STATEMENTS) await db.run(sql.raw(statement))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The table stays on rollback.
}
