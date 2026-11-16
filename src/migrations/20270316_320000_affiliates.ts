import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 31a: affiliate tracking. Two tables owned by the `affiliates` feature (created only when the section is
 * switched on, see src/features/registry.ts) and the `features_affiliates` switch on Site Settings. Idempotent. Down is a no-op.
 */
export const AFFILIATE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_affiliates\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`code\` text NOT NULL,
  \`name\` text NOT NULL DEFAULT '',
  \`email\` text NOT NULL DEFAULT '',
  \`status\` text NOT NULL DEFAULT 'pending',
  \`updated_at\` text,
  \`created_at\` text
)`,
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_affiliates_code_idx` ON `eg_affiliates` (`code`)',
  `CREATE TABLE IF NOT EXISTS \`eg_affiliate_visits\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`affiliate_id\` integer NOT NULL,
  \`path\` text NOT NULL DEFAULT '/',
  \`utm_source\` text NOT NULL DEFAULT '',
  \`utm_medium\` text NOT NULL DEFAULT '',
  \`utm_campaign\` text NOT NULL DEFAULT '',
  \`created_at\` text
)`,
  'CREATE INDEX IF NOT EXISTS `eg_affiliate_visits_aff_idx` ON `eg_affiliate_visits` (`affiliate_id`)',
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of AFFILIATE_STATEMENTS) await db.run(sql.raw(statement))
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_site_settings'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_site_settings`)'))) as { name: string }[]
  if (!existing.some((r) => r.name === 'features_affiliates')) {
    await db.run(sql.raw('ALTER TABLE `eg_site_settings` ADD COLUMN `features_affiliates` integer DEFAULT false'))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The tables stay on rollback.
}
