import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 30b: native live chat. Five tables owned by the `livechat` feature (created only when the section is
 * switched on, see src/features/registry.ts) and the `features_livechat` switch on Site Settings. Idempotent. Down is a no-op.
 */
export const LIVECHAT_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_livechat_settings\` (
  \`id\` integer PRIMARY KEY NOT NULL,
  \`data\` text NOT NULL DEFAULT '{}',
  \`updated_at\` text
)`,
  `CREATE TABLE IF NOT EXISTS \`eg_livechat_chats\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`token\` text NOT NULL,
  \`user_id\` integer,
  \`name\` text NOT NULL DEFAULT '',
  \`email\` text NOT NULL DEFAULT '',
  \`status\` text NOT NULL DEFAULT 'open',
  \`assigned_to\` integer,
  \`staff_seen_id\` integer NOT NULL DEFAULT 0,
  \`updated_at\` text,
  \`created_at\` text
)`,
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_livechat_chats_token_idx` ON `eg_livechat_chats` (`token`)',
  'CREATE INDEX IF NOT EXISTS `eg_livechat_chats_status_idx` ON `eg_livechat_chats` (`status`, `updated_at`)',
  'CREATE INDEX IF NOT EXISTS `eg_livechat_chats_user_idx` ON `eg_livechat_chats` (`user_id`)',
  `CREATE TABLE IF NOT EXISTS \`eg_livechat_messages\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`chat_id\` integer NOT NULL,
  \`sender\` text NOT NULL DEFAULT 'visitor',
  \`staff_id\` integer,
  \`name\` text NOT NULL DEFAULT '',
  \`content\` text NOT NULL DEFAULT '',
  \`is_note\` integer NOT NULL DEFAULT 0,
  \`created_at\` text
)`,
  'CREATE INDEX IF NOT EXISTS `eg_livechat_messages_chat_idx` ON `eg_livechat_messages` (`chat_id`, `id`)',
  `CREATE TABLE IF NOT EXISTS \`eg_livechat_canned\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`title\` text NOT NULL,
  \`body\` text NOT NULL,
  \`created_at\` text
)`,
  `CREATE TABLE IF NOT EXISTS \`eg_livechat_staff\` (
  \`user_id\` integer PRIMARY KEY NOT NULL,
  \`name\` text NOT NULL DEFAULT '',
  \`seen_at\` text
)`,
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of LIVECHAT_STATEMENTS) await db.run(sql.raw(statement))
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_site_settings'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_site_settings`)'))) as { name: string }[]
  if (!existing.some((r) => r.name === 'features_livechat')) {
    await db.run(sql.raw('ALTER TABLE `eg_site_settings` ADD COLUMN `features_livechat` integer DEFAULT false'))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The tables and column stay on rollback.
}
