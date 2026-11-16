import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 22d: franchising (franchises on their own domain, shared templates rolled out as locked pages). Tables owned by the `franchising` feature (created only when the section is
 * switched on, see src/features/registry.ts) and the `features_franchising` switch on Site Settings. Idempotent. Down is a no-op.
 */
export const FRANCHISE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_franchises\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`name\` text NOT NULL,
  \`host\` text NOT NULL,
  \`owner_email\` text NOT NULL DEFAULT '',
  \`status\` text NOT NULL DEFAULT 'active',
  \`updated_at\` text,
  \`created_at\` text
)`,
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_franchises_host_idx` ON `eg_franchises` (`host`)',
  `CREATE TABLE IF NOT EXISTS \`eg_franchise_pages\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`franchise_id\` integer NOT NULL,
  \`template_id\` integer NOT NULL,
  \`page_id\` integer NOT NULL,
  \`rolled_at\` text
)`,
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_franchise_pages_idx` ON `eg_franchise_pages` (`franchise_id`, `template_id`)',
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of FRANCHISE_STATEMENTS) await db.run(sql.raw(statement))
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_site_settings'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_site_settings`)'))) as { name: string }[]
  if (!existing.some((r) => r.name === 'features_franchising')) {
    await db.run(sql.raw('ALTER TABLE `eg_site_settings` ADD COLUMN `features_franchising` integer DEFAULT false'))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The tables and column stay on rollback.
}
