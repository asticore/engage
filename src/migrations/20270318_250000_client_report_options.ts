import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 17f: client reports get chosen sections and fixed dates. Adds `sections` (comma list, empty = all), `range_from` and `range_to`
 * to `eg_client_reports`. Idempotent. Down is a no-op.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_client_reports'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_client_reports`)'))) as { name: string }[]
  for (const column of ['sections', 'range_from', 'range_to']) {
    if (!existing.some((r) => r.name === column)) await db.run(sql.raw(`ALTER TABLE \`eg_client_reports\` ADD COLUMN \`${column}\` text NOT NULL DEFAULT ''`))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The columns stay on rollback.
}
