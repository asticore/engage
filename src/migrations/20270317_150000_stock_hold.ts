import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 23e: optional stock hold while a cart is in checkout. The table of holds (see server/stockHold.ts) and the two
 * switches on globals/ShopExtraSettings.ts (`stockHoldEnabled`, `stockHoldMinutes`). Idempotent. Down is a no-op.
 */
const TABLE = `CREATE TABLE IF NOT EXISTS \`eg_stock_reservations\` (
  \`id\` integer PRIMARY KEY NOT NULL,
  \`pool_key\` text NOT NULL,
  \`cart_id\` numeric NOT NULL,
  \`quantity\` integer NOT NULL,
  \`expires_at\` text NOT NULL,
  \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
)`
const INDEXES = [
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_stock_reservations_pool_cart_idx` ON `eg_stock_reservations` (`pool_key`, `cart_id`)',
  'CREATE INDEX IF NOT EXISTS `eg_stock_reservations_pool_expires_idx` ON `eg_stock_reservations` (`pool_key`, `expires_at`)',
]
const COLUMNS: [string, string][] = [
  ['stock_hold_enabled', 'integer DEFAULT false'],
  ['stock_hold_minutes', 'numeric DEFAULT 15'],
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql.raw(TABLE))
  for (const statement of INDEXES) await db.run(sql.raw(statement))
  const have = new Set(((await db.all(sql.raw('PRAGMA table_info(`eg_shop_extra_settings`)'))) as { name: string }[]).map((r) => r.name))
  if (have.size === 0) return
  for (const [column, type] of COLUMNS) {
    if (!have.has(column)) await db.run(sql.raw(`ALTER TABLE \`eg_shop_extra_settings\` ADD COLUMN \`${column}\` ${type}`))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The table and columns stay on rollback.
}
