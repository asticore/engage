import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 12d: places claimed at checkout for purchase limits. One short-lived row per cart and product, written before the
 * limit is counted so two orders racing for the last allowed place cannot both pass. Owned by the `limits` feature.
 * Idempotent. Down is a no-op.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(
    sql.raw(`CREATE TABLE IF NOT EXISTS \`eg_purchase_limit_claims\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`cart_id\` integer NOT NULL,
  \`product_id\` integer NOT NULL,
  \`email_key\` text NOT NULL DEFAULT '',
  \`user_id\` integer,
  \`address_key\` text NOT NULL DEFAULT '',
  \`qty\` integer NOT NULL DEFAULT 1,
  \`created_at\` text,
  \`expires_at\` text NOT NULL
)`),
  )
  await db.run(sql.raw('CREATE UNIQUE INDEX IF NOT EXISTS `eg_purchase_limit_claims_cart_product_idx` ON `eg_purchase_limit_claims` (`cart_id`, `product_id`)'))
  await db.run(sql.raw('CREATE INDEX IF NOT EXISTS `eg_purchase_limit_claims_product_idx` ON `eg_purchase_limit_claims` (`product_id`, `expires_at`)'))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The table stays on rollback.
}
