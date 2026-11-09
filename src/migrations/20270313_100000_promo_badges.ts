import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

// Promo badges on product cards: the `promoBadgesEnabled` switch and the `promoBadges` array on the
// shop-extra-settings global (src/globals/ShopExtraSettings.ts). Idempotent: the child table is CREATE ... IF NOT
// EXISTS, the switch column is added only when PRAGMA table_info says it is missing, indexes are IF NOT EXISTS.
// Column names mirror what src/cms/db/schema/generate.ts produces for that array.

type Runner = MigrateUpArgs['db']

const BADGE_COLS = [
  '`text` text',
  '`enabled` integer DEFAULT true',
  '`icon` text',
  "`colour` text DEFAULT '#b3261e'",
  "`text_colour` text DEFAULT '#ffffff'",
  "`position` text DEFAULT 'top-left'",
  "`style` text DEFAULT 'solid'",
  "`shape` text DEFAULT 'rounded'",
  "`effect` text DEFAULT 'none'",
  "`applies_to` text DEFAULT 'all'",
  '`new_days` numeric DEFAULT 30',
  '`tag` text',
  '`category` text',
  '`product_slugs` text',
  '`priority` numeric DEFAULT 10',
  '`starts_at` text',
  '`ends_at` text',
]

const TABLE = `CREATE TABLE IF NOT EXISTS \`eg_shop_extra_settings_promo_badges\` (\n  \`_order\` integer NOT NULL,\n  \`_parent_id\` integer NOT NULL,\n  \`id\` text PRIMARY KEY NOT NULL,\n${BADGE_COLS.map((c) => '  ' + c).join(',\n')},\n  FOREIGN KEY (\`_parent_id\`) REFERENCES \`eg_shop_extra_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade\n)`

const INDEXES = [
  'CREATE INDEX IF NOT EXISTS `eg_shop_extra_settings_promo_badges_order_idx` ON `eg_shop_extra_settings_promo_badges` (`_order`)',
  'CREATE INDEX IF NOT EXISTS `eg_shop_extra_settings_promo_badges_parent_id_idx` ON `eg_shop_extra_settings_promo_badges` (`_parent_id`)',
]

const columnsOf = async (db: Runner, table: string): Promise<Set<string>> =>
  new Set(((await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]).map((r) => r.name))

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  await db.run(sql.raw(TABLE))
  for (const statement of INDEXES) await db.run(sql.raw(statement))
  const have = await columnsOf(db, 'eg_shop_extra_settings')
  if (have.size > 0 && !have.has('promo_badges_enabled')) {
    await db.run(sql.raw('ALTER TABLE `eg_shop_extra_settings` ADD COLUMN `promo_badges_enabled` integer DEFAULT true'))
  }
  engine.logger.info('[migrate] promo badges ready.')
}

export async function down({ engine }: MigrateDownArgs): Promise<void> {
  engine.logger.info('[migrate] Down is a no-op - the promo badge table and column are left in place.')
}
