import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 27a and 27b: comments on blog posts. Two tables owned by the `comments` feature (created only when the section is
 * switched on, see src/features/registry.ts) and the `features_comments` switch on Site Settings. Idempotent. Down is a no-op.
 */
export const COMMENT_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_comments\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`ref_type\` text NOT NULL DEFAULT 'post',
  \`ref_id\` integer NOT NULL,
  \`parent_id\` integer,
  \`author_name\` text NOT NULL DEFAULT '',
  \`author_email\` text NOT NULL DEFAULT '',
  \`user_id\` integer,
  \`content\` text NOT NULL DEFAULT '',
  \`status\` text NOT NULL DEFAULT 'pending',
  \`from_team\` integer NOT NULL DEFAULT 0,
  \`ip_hash\` text NOT NULL DEFAULT '',
  \`updated_at\` text,
  \`created_at\` text
)`,
  'CREATE INDEX IF NOT EXISTS `eg_comments_ref_idx` ON `eg_comments` (`ref_type`, `ref_id`, `status`)',
  `CREATE TABLE IF NOT EXISTS \`eg_comment_settings\` (
  \`id\` integer PRIMARY KEY NOT NULL,
  \`mode\` text NOT NULL DEFAULT 'all',
  \`signed_in_auto\` integer NOT NULL DEFAULT 0,
  \`max_depth\` integer NOT NULL DEFAULT 3,
  \`close_after_days\` integer NOT NULL DEFAULT 0,
  \`blocked_words\` text NOT NULL DEFAULT ''
)`,
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of COMMENT_STATEMENTS) await db.run(sql.raw(statement))
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_site_settings'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_site_settings`)'))) as { name: string }[]
  if (!existing.some((r) => r.name === 'features_comments')) {
    await db.run(sql.raw('ALTER TABLE `eg_site_settings` ADD COLUMN `features_comments` integer DEFAULT false'))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The tables and column stay on rollback.
}
