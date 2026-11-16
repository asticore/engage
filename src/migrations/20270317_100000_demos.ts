import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 22g: agency demo sites (a saved copy of the demo, scheduled reset, demo accounts). Tables owned by the `demos` feature (created only when the section is
 * switched on, see src/features/registry.ts) and the `features_demos` switch on Site Settings. Idempotent. Down is a no-op.
 */
export const DEMO_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_demo_settings\` (
  \`id\` integer PRIMARY KEY NOT NULL,
  \`reset_every\` text NOT NULL DEFAULT 'off',
  \`last_reset_at\` text,
  \`last_result\` text NOT NULL DEFAULT '',
  \`banner\` text NOT NULL DEFAULT '',
  \`updated_at\` text
)`,
  `CREATE TABLE IF NOT EXISTS \`eg_demo_snapshots\` (
  \`id\` integer PRIMARY KEY NOT NULL,
  \`taken_at\` text NOT NULL,
  \`size\` integer NOT NULL DEFAULT 0,
  \`body\` text NOT NULL
)`,
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of DEMO_STATEMENTS) await db.run(sql.raw(statement))
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_site_settings'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_site_settings`)'))) as { name: string }[]
  if (!existing.some((r) => r.name === 'features_demos')) {
    await db.run(sql.raw('ALTER TABLE `eg_site_settings` ADD COLUMN `features_demos` integer DEFAULT false'))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The tables and column stay on rollback.
}
