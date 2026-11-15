import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 21b: the Pinterest Tag ID, kept on Tracking connections (eg_integrations is at the column limit). Idempotent.
 * Down is a no-op.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_tracking_connections'`)) as { name: string }[]
  if (tables.length === 0) return
  const cols = (await db.all(sql.raw('PRAGMA table_info(`eg_tracking_connections`)'))) as { name: string }[]
  if (!cols.some((c) => c.name === 'pinterest_tag_id')) await db.run(sql.raw('ALTER TABLE `eg_tracking_connections` ADD COLUMN `pinterest_tag_id` text'))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The column stays on rollback.
}
