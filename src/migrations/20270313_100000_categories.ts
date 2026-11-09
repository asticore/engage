import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Nested categories (Task 7): `eg_categories` (a tree per scope, 'shop' or 'blog', with a parent and an order) and
 * `eg_category_links` (which documents sit in which category). Existing flat categories are untouched: blog posts keep
 * their own category names and a site with no rows here behaves exactly as before.
 *
 * Mirror: src/cms/db/schema/categories.ts. Idempotent: CREATE ... IF NOT EXISTS. Registered last in src/migrations/index.ts.
 */

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_categories\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`scope\` text NOT NULL,
  \`name\` text NOT NULL,
  \`slug\` text NOT NULL,
  \`parent_id\` integer,
  \`sort_order\` integer DEFAULT 0 NOT NULL,
  \`created_at\` text NOT NULL,
  \`updated_at\` text NOT NULL
)`,
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_categories_scope_slug_idx` ON `eg_categories` (`scope`, `slug`)',
  'CREATE INDEX IF NOT EXISTS `eg_categories_parent_idx` ON `eg_categories` (`parent_id`)',
  `CREATE TABLE IF NOT EXISTS \`eg_category_links\` (
  \`category_id\` integer NOT NULL,
  \`scope\` text NOT NULL,
  \`doc_id\` integer NOT NULL,
  PRIMARY KEY (\`category_id\`, \`doc_id\`)
)`,
  'CREATE INDEX IF NOT EXISTS `eg_category_links_doc_idx` ON `eg_category_links` (`scope`, `doc_id`)',
]

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  for (const statement of STATEMENTS) await db.run(sql.raw(statement))
  engine.logger.info('[migrate] Category tables are present.')
}

export async function down({ engine }: MigrateDownArgs): Promise<void> {
  engine.logger.info('[migrate] Down is a no-op - the category tables are left in place.')
}
