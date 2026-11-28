import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 6 (16d): breadcrumb text colour, link colour and size on SEO settings (group `breadcrumbs`). Idempotent. Down is a no-op.
 */
const COLUMNS: Array<[string, string]> = [
  ['breadcrumbs_text_color', 'text'],
  ['breadcrumbs_link_color', 'text'],
  ['breadcrumbs_font_size', 'text'],
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
