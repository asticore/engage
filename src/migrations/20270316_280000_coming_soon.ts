import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 21i: coming soon mode and launch date on the site pages global. Idempotent. Down is a no-op. */
const COLUMNS: Array<[string, string]> = [
  ['maintenance_mode', "text DEFAULT 'maintenance'"],
  ['maintenance_launch_date', 'text'],
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_site_pages'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_site_pages`)'))) as { name: string }[]
  for (const [name, type] of COLUMNS) {
    if (!existing.some((c) => c.name === name)) await db.run(sql.raw(`ALTER TABLE \`eg_site_pages\` ADD COLUMN \`${name}\` ${type}`))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The columns stay on rollback.
}
