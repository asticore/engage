import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 23e: the cart lifetime setting on globals/ShopExtraSettings.ts (`cartLifetimeDays`). Idempotent. Down is a no-op. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const have = new Set(((await db.all(sql.raw('PRAGMA table_info(`eg_shop_extra_settings`)'))) as { name: string }[]).map((r) => r.name))
  if (have.size === 0) return
  if (!have.has('cart_lifetime_days')) await db.run(sql.raw('ALTER TABLE `eg_shop_extra_settings` ADD COLUMN `cart_lifetime_days` numeric DEFAULT 30'))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The column stays on rollback.
}
