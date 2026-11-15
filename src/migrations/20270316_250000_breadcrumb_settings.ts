import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 21d: sitewide breadcrumb settings on SEO settings (group `breadcrumbs`): separator, home label, link the last
 * crumb, structured data on or off. Idempotent. Down is a no-op.
 */
const COLUMNS: Array<[string, string]> = [
  ['breadcrumbs_separator', "text DEFAULT '/'"],
  ['breadcrumbs_home_label', "text DEFAULT 'Home'"],
  ['breadcrumbs_link_last', 'integer DEFAULT 0'],
  ['breadcrumbs_structured_data', 'integer DEFAULT 1'],
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_seo_settings'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_seo_settings`)'))) as { name: string }[]
  for (const [name, type] of COLUMNS) {
    if (!existing.some((c) => c.name === name)) await db.run(sql.raw(`ALTER TABLE \`eg_seo_settings\` ADD COLUMN \`${name}\` ${type}`))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The columns stay on rollback.
}
