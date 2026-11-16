import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 21l: site planner. One table owned by the `siteplanner` feature (created only when the section is switched on,
 * see src/features/registry.ts) and the `features_siteplanner` switch on Site Settings. Idempotent. Down is a no-op.
 */
export const SITE_PLANNER_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_site_plans\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`name\` text NOT NULL,
  \`idea\` text NOT NULL DEFAULT '',
  \`answers\` text NOT NULL DEFAULT '',
  \`plan\` text NOT NULL DEFAULT '{"pages":[]}',
  \`updated_at\` text,
  \`created_at\` text
)`,
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of SITE_PLANNER_STATEMENTS) await db.run(sql.raw(statement))
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_site_settings'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_site_settings`)'))) as { name: string }[]
  if (!existing.some((r) => r.name === 'features_siteplanner')) {
    await db.run(sql.raw('ALTER TABLE `eg_site_settings` ADD COLUMN `features_siteplanner` integer DEFAULT false'))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The table stays on rollback.
}
