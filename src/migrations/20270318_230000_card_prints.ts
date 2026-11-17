import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 12d: card fingerprint match for purchase limits. One row per paid order and card fingerprint (the opaque id
 * Stripe gives a card, never the number), so orders paid with the same card count as the same person. Owned by the
 * `limits` feature. Idempotent. Down is a no-op.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(
    sql.raw(`CREATE TABLE IF NOT EXISTS \`eg_purchase_card_prints\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`order_id\` integer NOT NULL,
  \`fingerprint\` text NOT NULL,
  \`created_at\` text
)`),
  )
  await db.run(sql.raw('CREATE UNIQUE INDEX IF NOT EXISTS `eg_purchase_card_prints_order_fp_idx` ON `eg_purchase_card_prints` (`order_id`, `fingerprint`)'))
  await db.run(sql.raw('CREATE INDEX IF NOT EXISTS `eg_purchase_card_prints_fp_idx` ON `eg_purchase_card_prints` (`fingerprint`)'))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The table stays on rollback.
}
