import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 16d: pricing rules that match on the customer: lifetime spend, number of past orders and shipping country.
 * Columns on the pricing rules child table of the Shop switches global (globals/ShopExtraSettings.ts). Idempotent. Down is a no-op.
 */
const COLUMNS: [string, string][] = [
  ['min_lifetime_spend', 'numeric'],
  ['min_orders', 'numeric'],
  ['country', 'text'],
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const table = 'eg_shop_extra_settings_pricing_rules'
  const have = new Set(((await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]).map((r) => r.name))
  if (have.size === 0) return
  for (const [column, type] of COLUMNS) {
    if (!have.has(column)) await db.run(sql.raw(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${type}`))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The columns stay on rollback.
}
