import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 8 (shop): product tags and brands, offline payment methods (bank transfer, cheque, cash on delivery), the
 * order payment method, and the review request switch and wording.
 *
 * Idempotent: tables are CREATE ... IF NOT EXISTS, columns are only added when PRAGMA table_info says they are
 * missing, and a table that does not exist yet (its feature was never installed) is skipped. Names mirror what
 * src/cms/db/schema/generate.ts produces for src/features/ecommerce/collections/{ProductTags,ProductBrands,Products,Orders}.ts
 * and src/globals/{PaymentSettings,ShopSettings}.ts. Stored payment records (transactions) are not touched.
 */

type Runner = MigrateUpArgs['db']

const TS = "  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,\n  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL"

const create = (name: string, cols: string[]): string =>
  `CREATE TABLE IF NOT EXISTS \`${name}\` (\n  \`id\` integer PRIMARY KEY NOT NULL,\n${cols.map((c) => '  ' + c).join(',\n')},\n${TS}\n)`

const TABLES: string[] = [
  create('eg_product_tags', ['`name` text NOT NULL', '`slug` text']),
  create('eg_product_brands', ['`name` text NOT NULL', '`slug` text', '`description` text']),
]

const INDEXES: string[] = [
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_product_tags_name_idx` ON `eg_product_tags` (`name`)',
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_product_tags_slug_idx` ON `eg_product_tags` (`slug`)',
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_product_brands_name_idx` ON `eg_product_brands` (`name`)',
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_product_brands_slug_idx` ON `eg_product_brands` (`slug`)',
  'CREATE INDEX IF NOT EXISTS `eg_product_tags_created_at_idx` ON `eg_product_tags` (`created_at`)',
  'CREATE INDEX IF NOT EXISTS `eg_product_brands_created_at_idx` ON `eg_product_brands` (`created_at`)',
  'CREATE INDEX IF NOT EXISTS `eg_products_brand_id_idx` ON `eg_products` (`brand_id`)',
  'CREATE INDEX IF NOT EXISTS `eg_products_rels_eg_product_tags_id_idx` ON `eg_products_rels` (`eg_product_tags_id`)',
  'CREATE INDEX IF NOT EXISTS `_eg_products_v_rels_eg_product_tags_id_idx` ON `_eg_products_v_rels` (`eg_product_tags_id`)',
  'CREATE INDEX IF NOT EXISTS `eg_orders_payment_method_idx` ON `eg_orders` (`payment_method`)',
]

const COLUMNS: Record<string, [string, string][]> = {
  eg_products: [['brand_id', 'integer REFERENCES `eg_product_brands`(`id`) ON DELETE set null']],
  _eg_products_v: [['version_brand_id', 'integer']],
  eg_products_rels: [['eg_product_tags_id', 'integer']],
  _eg_products_v_rels: [['eg_product_tags_id', 'integer']],
  eg_orders: [['payment_method', 'text']],
  // Shop settings is at the D1 column limit, so the review request switch and wording live on the shop switches row.
  eg_shop_extra_settings: [
    ['review_request_email', 'integer DEFAULT false'],
    ['review_request_subject', 'text'],
    ['review_request_body', 'text'],
  ],
  eg_payment_settings: [
    ['offline_bank_transfer_enabled', 'integer DEFAULT false'],
    ['offline_bank_transfer_details', 'text'],
    ['offline_cheque_enabled', 'integer DEFAULT false'],
    ['offline_cheque_details', 'text'],
    ['offline_cod_enabled', 'integer DEFAULT false'],
    ['offline_cod_details', 'text'],
  ],
  eg_locked_documents_rels: [
    ['eg_product_tags_id', 'integer'],
    ['eg_product_brands_id', 'integer'],
  ],
}

const columnsOf = async (db: Runner, table: string): Promise<Set<string>> =>
  new Set(((await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]).map((r) => r.name))

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  for (const statement of TABLES) await db.run(sql.raw(statement))
  for (const [table, cols] of Object.entries(COLUMNS)) {
    const have = await columnsOf(db, table)
    // A table that does not exist (its feature was never set up) is skipped; a later run picks it up.
    if (have.size === 0) continue
    for (const [column, type] of cols) {
      if (have.has(column)) continue
      await db.run(sql.raw(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${type}`))
    }
  }
  for (const statement of INDEXES) {
    const table = /ON `([^`]+)`/.exec(statement)?.[1]
    if (table && (await columnsOf(db, table)).size === 0) continue
    await db.run(sql.raw(statement))
  }
  engine.logger.info('[migrate] Product tags and brands, offline payment settings, order payment method and order e-mail switches are present.')
}

export async function down({ engine }: MigrateDownArgs): Promise<void> {
  engine.logger.info('[migrate] Down is a no-op - the tag, brand and offline payment columns and tables are left in place.')
}
