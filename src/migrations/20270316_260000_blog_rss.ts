import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 21f: blog RSS switch and mode on Blog settings. Idempotent. Down is a no-op. */
const COLUMNS: Array<[string, string]> = [
  ['rss_enabled', 'integer DEFAULT 1'],
  ['rss_mode', "text DEFAULT 'summary'"],
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_blog_settings'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_blog_settings`)'))) as { name: string }[]
  for (const [name, type] of COLUMNS) {
    if (!existing.some((c) => c.name === name)) await db.run(sql.raw(`ALTER TABLE \`eg_blog_settings\` ADD COLUMN \`${name}\` ${type}`))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The columns stay on rollback.
}
