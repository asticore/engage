import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 23e: the pre-checkout stock hold switch (`stockHoldInCart` on ShopExtraSettings). Idempotent. Down is a no-op. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const have = new Set(((await db.all(sql.raw('PRAGMA table_info(`eg_shop_extra_settings`)'))) as { name: string }[]).map((r) => r.name))
  if (have.size === 0 || have.has('stock_hold_in_cart')) return
  await db.run(sql.raw('ALTER TABLE `eg_shop_extra_settings` ADD COLUMN `stock_hold_in_cart` integer DEFAULT false'))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The column stays on rollback.
}
