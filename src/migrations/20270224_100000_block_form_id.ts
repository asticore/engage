import { MigrateUpArgs, sql } from '@/engine/db'

type Runner = MigrateUpArgs['db']

/**
 * Schema gap: the page-builder Form block's `form` field is a plain relationship
 * (src/features/forms/block.ts), so the engine writes a `form_id` column on each
 * block table that holds it. Only `eg_lessons_blocks_form` got that column; the
 * other twelve block tables were created without it, so creating a Form block on
 * a page, post, product, template, global, reusable section or site template
 * failed with "no such column: form_id".
 *
 * This adds `form_id` (a nullable reference to `eg_forms`) and an index on it to
 * each of those tables, so the shadow schema in src/cms/db/schema matches the
 * database. Idempotent: a table that already has the column is left alone, so a
 * fresh install (which creates the tables above with the column) and an upgrade
 * both succeed. Down is a no-op, as for the other column migrations.
 */

const FORM_BLOCK_TABLES = [
  'eg_pages_blocks_form',
  '_eg_pages_v_blocks_form',
  'eg_posts_blocks_form',
  '_eg_posts_v_blocks_form',
  'eg_products_blocks_form',
  '_eg_products_v_blocks_form',
  'eg_page_templates_blocks_form',
  'eg_blog_settings_blocks_form',
  'eg_faq_settings_blocks_form',
  'eg_shop_settings_blocks_form',
  'eg_reusable_sections_blocks_form',
  'eg_site_templates_blocks_form',
]

const tableExists = async (db: Runner, table: string): Promise<boolean> => {
  const rows = (await db.all(sql.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`))) as { name: string }[]
  return rows.length > 0
}

const columnExists = async (db: Runner, table: string, column: string): Promise<boolean> => {
  const rows = (await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]
  return rows.some((r) => r.name === column)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const table of FORM_BLOCK_TABLES) {
    if (!(await tableExists(db, table))) continue
    if (!(await columnExists(db, table, 'form_id'))) {
      await db.run(sql.raw(`ALTER TABLE \`${table}\` ADD COLUMN \`form_id\` integer REFERENCES \`eg_forms\`(\`id\`)`))
    }
    await db.run(sql.raw(`CREATE INDEX IF NOT EXISTS \`${table}_form_id_idx\` ON \`${table}\` (\`form_id\`)`))
  }
}

export async function down(): Promise<void> {
  // SQLite does not support DROP COLUMN; the columns are left in place.
}
