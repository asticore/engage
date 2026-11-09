import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

type Runner = MigrateUpArgs['db']

/**
 * Tasks 3 and 4 of docs/remaining-work.md.
 * - Multi-currency: `rounding` column on eg_shop_display_currencies (none, whole, nearest5, ends99).
 * - Multi-level pricing: eg_shop_price_tiers, one row per quantity break, optionally for one variation
 *   and one customer type (role). '' means "all". Read and written with raw SQL (see
 *   src/features/ecommerce/server/priceTiers.ts), so it is not in the drizzle schema.
 * Idempotent: CREATE ... IF NOT EXISTS, and the column is added only when missing.
 */

const TABLE = `CREATE TABLE IF NOT EXISTS \`eg_shop_price_tiers\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`product_id\` text NOT NULL,
  \`variation_id\` text DEFAULT '' NOT NULL,
  \`customer_type\` text DEFAULT '' NOT NULL,
  \`min_qty\` integer DEFAULT 1 NOT NULL,
  \`price\` numeric NOT NULL,
  \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
)`

const UNIQUE = 'CREATE UNIQUE INDEX IF NOT EXISTS `eg_shop_price_tiers_unique_idx` ON `eg_shop_price_tiers` (`product_id`, `variation_id`, `customer_type`, `min_qty`)'

const columnExists = async (db: Runner, table: string, column: string): Promise<boolean> => {
  try {
    const rows = (await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]
    return rows.some((r) => r.name === column)
  } catch {
    return false
  }
}

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  await db.run(sql.raw(TABLE))
  await db.run(sql.raw(UNIQUE))
  // The display currency table is created by an earlier migration; create it defensively if it is somehow absent.
  if (!(await columnExists(db, 'eg_shop_display_currencies', 'code'))) {
    await db.run(sql.raw("CREATE TABLE IF NOT EXISTS `eg_shop_display_currencies` (`code` text PRIMARY KEY NOT NULL, `enabled` integer DEFAULT 1 NOT NULL, `sort_order` integer DEFAULT 0 NOT NULL, `rate_mode` text DEFAULT 'manual' NOT NULL, `manual_rate` numeric, `auto_rate` numeric, `auto_rate_base` text, `auto_rate_at` text, `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL, `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL)"))
  }
  if (!(await columnExists(db, 'eg_shop_display_currencies', 'rounding'))) {
    await db.run(sql.raw("ALTER TABLE `eg_shop_display_currencies` ADD COLUMN `rounding` text DEFAULT 'none' NOT NULL"))
  }
  engine.logger.info('[migrate] Price tiers table and display currency rounding column are present.')
}

export async function down({ engine }: MigrateDownArgs): Promise<void> {
  engine.logger.info('[migrate] Down is a no-op - price tiers and the rounding column are left in place.')
}
