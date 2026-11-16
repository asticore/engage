import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 22h: GA4 user_id switches on SEO settings. Idempotent. Down is a no-op. */
const COLUMNS: Array<[string, string]> = [
  ['analytics_send_user_id', 'integer DEFAULT 0'],
  ['analytics_hash_user_id', 'integer DEFAULT 1'],
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
