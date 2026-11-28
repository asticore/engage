import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Footer setting: show the small "Built with Engage" link (on by default). Idempotent. Down is a no-op. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_footer'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_footer`)'))) as { name: string }[]
  if (!existing.some((c) => c.name === 'show_built_with')) await db.run(sql.raw('ALTER TABLE `eg_footer` ADD COLUMN `show_built_with` integer DEFAULT true'))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The column stays on rollback.
}
