import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 11d: wholesale mode. The shop switches live on the Shop switches row (eg_shop_extra_settings, because Shop
 * settings is at the D1 column limit), `wholesale_only` is a product field (products are versioned, so the version table
 * gets the same column with a `version_` prefix), and applications and customer tags have their own plain tables.
 * Idempotent. Down is a no-op.
 */
export const WHOLESALE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_wholesale_applications\` (
  \`user_id\` integer PRIMARY KEY NOT NULL,
  \`email\` text NOT NULL DEFAULT '',
  \`company\` text NOT NULL DEFAULT '',
  \`tax_id\` text NOT NULL DEFAULT '',
  \`phone\` text NOT NULL DEFAULT '',
  \`message\` text NOT NULL DEFAULT '',
  \`status\` text NOT NULL DEFAULT 'pending',
  \`organization_id\` text,
  \`note\` text NOT NULL DEFAULT '',
  \`applied_at\` text,
  \`decided_at\` text,
  \`decided_by\` text NOT NULL DEFAULT ''
)`,
  'CREATE INDEX IF NOT EXISTS `eg_wholesale_applications_status_idx` ON `eg_wholesale_applications` (`status`)',
  `CREATE TABLE IF NOT EXISTS \`eg_customer_tags\` (
  \`user_id\` integer NOT NULL,
  \`tag\` text NOT NULL,
  PRIMARY KEY (\`user_id\`, \`tag\`)
)`,
  'CREATE INDEX IF NOT EXISTS `eg_customer_tags_tag_idx` ON `eg_customer_tags` (`tag`)',
]

const COLUMNS: Record<string, [string, string][]> = {
  eg_shop_extra_settings: [
    ['wholesale_enabled', 'integer DEFAULT false'],
    ['wholesale_role', 'text'],
    ['wholesale_hide_prices', 'integer DEFAULT false'],
    ['wholesale_hide_from', "text DEFAULT 'guests'"],
    ['wholesale_hidden_price_text', 'text'],
    ['wholesale_min_order', 'numeric'],
    ['wholesale_apply_open', 'integer DEFAULT false'],
  ],
  eg_products: [['wholesale_only', 'integer DEFAULT false']],
  _eg_products_v: [['version_wholesale_only', 'integer DEFAULT false']],
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of WHOLESALE_STATEMENTS) await db.run(sql.raw(statement))
  for (const [table, cols] of Object.entries(COLUMNS)) {
    const have = new Set(((await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]).map((r) => r.name))
    if (have.size === 0) continue
    for (const [column, type] of cols) {
      if (!have.has(column)) await db.run(sql.raw(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${type}`))
    }
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The tables and columns stay on rollback.
}
