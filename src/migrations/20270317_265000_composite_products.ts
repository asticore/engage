import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

// Composite products ("build your own kit"). Idempotent: tables are CREATE ... IF NOT EXISTS, the cart column is
// only added when PRAGMA table_info says it is missing, indexes are IF NOT EXISTS. Names mirror what
// src/cms/db/schema/generate.ts produces for src/features/ecommerce/collections/productComposite.ts (the
// compositeOptions and compositeRules arrays, live and versioned) and the `composite` text field on cart items
// (src/features/ecommerce/collections/shared.ts). Per-product data lives in child tables, so eg_products gains no column.

type Runner = MigrateUpArgs['db']

const child = (name: string, parent: string, cols: string[], versioned = false): string =>
  `CREATE TABLE IF NOT EXISTS \`${name}\` (\n  \`_order\` integer NOT NULL,\n  \`_parent_id\` integer NOT NULL,\n  \`id\` ${versioned ? 'integer' : 'text'} PRIMARY KEY NOT NULL,\n${cols.map((c) => '  ' + c).join(',\n')}${versioned ? ',\n  `_uuid` text' : ''},\n  FOREIGN KEY (\`_parent_id\`) REFERENCES \`${parent}\`(\`id\`) ON UPDATE no action ON DELETE cascade\n)`

const noNotNull = (cols: string[]): string[] => cols.map((c) => c.replace(' NOT NULL', ''))

const OPTION_COLS = [
  '`component` text NOT NULL',
  '`product_id` integer',
  "`price_mode` text DEFAULT 'included'",
  '`price_value` numeric',
  '`is_default` integer DEFAULT false',
]

const RULE_COLS = ['`component` text NOT NULL', '`description` text', '`required` integer DEFAULT true', '`min_choices` numeric', '`max_choices` numeric']

const TABLES: string[] = [
  child('eg_products_composite_options', 'eg_products', OPTION_COLS),
  child('_eg_products_v_version_composite_options', '_eg_products_v', noNotNull(OPTION_COLS), true),
  child('eg_products_composite_rules', 'eg_products', RULE_COLS),
  child('_eg_products_v_version_composite_rules', '_eg_products_v', noNotNull(RULE_COLS), true),
]

const INDEXED = ['eg_products_composite_options', '_eg_products_v_version_composite_options', 'eg_products_composite_rules', '_eg_products_v_version_composite_rules']

const columnsOf = async (db: Runner, table: string): Promise<Set<string>> =>
  new Set(((await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]).map((r) => r.name))

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  // The child tables need their parent table; a partial install without products gets them from the catalogue migration first.
  if ((await columnsOf(db, 'eg_products')).size > 0) {
    for (const statement of TABLES) await db.run(sql.raw(statement))
    for (const table of INDEXED) {
      await db.run(sql.raw(`CREATE INDEX IF NOT EXISTS \`${table}_order_idx\` ON \`${table}\` (\`_order\`)`))
      await db.run(sql.raw(`CREATE INDEX IF NOT EXISTS \`${table}_parent_id_idx\` ON \`${table}\` (\`_parent_id\`)`))
    }
  }
  const have = await columnsOf(db, 'eg_carts_items')
  if (have.size > 0 && !have.has('composite')) await db.run(sql.raw('ALTER TABLE `eg_carts_items` ADD COLUMN `composite` text'))
  engine.logger.info('[migrate] composite product tables and cart column ready.')
}

export async function down({ engine }: MigrateDownArgs): Promise<void> {
  // SQLite cannot drop columns cheaply and the tables hold merchant data: both are left in place and ignored when unused.
  engine.logger.info('[migrate] Down is a no-op - the composite product tables and cart column are left in place.')
}
