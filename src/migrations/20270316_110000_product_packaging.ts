import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 16a: carton and pallet quantities on products. Columns for the fields in
 * src/features/ecommerce/collections/productFields.ts (packagingFields). Products are versioned, so the
 * version table gets the same columns with a `version_` prefix. Idempotent. Down is a no-op.
 */
const PRODUCT_COLS: [string, string][] = [
  ['units_per_carton', 'numeric'],
  ['cartons_per_pallet', 'numeric'],
  ['sell_in_multiples_of', "text DEFAULT 'unit'"],
  ['round_up', 'integer DEFAULT false'],
  ['min_cartons', 'numeric'],
]

const COLUMNS: Record<string, [string, string][]> = {
  eg_products: PRODUCT_COLS,
  _eg_products_v: PRODUCT_COLS.map(([name, type]): [string, string] => [`version_${name}`, type]),
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const [table, cols] of Object.entries(COLUMNS)) {
    const have = new Set(((await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]).map((r) => r.name))
    if (have.size === 0) continue
    for (const [column, type] of cols) {
      if (!have.has(column)) await db.run(sql.raw(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${type}`))
    }
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The columns stay on rollback.
}
