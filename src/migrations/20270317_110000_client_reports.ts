import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 22f: client reports (read-only share links and scheduled report emails). Tables owned by the `clientreports` feature (created only when the section is
 * switched on, see src/features/registry.ts) and the `features_clientreports` switch on Site Settings. Idempotent. Down is a no-op.
 */
export const CLIENT_REPORT_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_client_reports\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`name\` text NOT NULL,
  \`token\` text NOT NULL,
  \`preset\` text NOT NULL DEFAULT '30d',
  \`recipients\` text NOT NULL DEFAULT '',
  \`cadence\` text NOT NULL DEFAULT 'none',
  \`last_sent_at\` text,
  \`revoked\` integer NOT NULL DEFAULT 0,
  \`updated_at\` text,
  \`created_at\` text
)`,
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_client_reports_token_idx` ON `eg_client_reports` (`token`)',
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of CLIENT_REPORT_STATEMENTS) await db.run(sql.raw(statement))
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_site_settings'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_site_settings`)'))) as { name: string }[]
  if (!existing.some((r) => r.name === 'features_clientreports')) {
    await db.run(sql.raw('ALTER TABLE `eg_site_settings` ADD COLUMN `features_clientreports` integer DEFAULT false'))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The tables and column stay on rollback.
}
