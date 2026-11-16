import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 30a: the site chatbot. Three tables owned by the `chatbot` feature (created only when the section is
 * switched on, see src/features/registry.ts) and the `features_chatbot` switch on Site Settings. Idempotent. Down is a no-op.
 */
export const CHATBOT_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_chatbot_settings\` (
  \`id\` integer PRIMARY KEY NOT NULL,
  \`data\` text NOT NULL DEFAULT '{}',
  \`updated_at\` text
)`,
  `CREATE TABLE IF NOT EXISTS \`eg_chatbot_conversations\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`token\` text NOT NULL,
  \`user_id\` integer,
  \`handed_off\` integer NOT NULL DEFAULT 0,
  \`updated_at\` text,
  \`created_at\` text
)`,
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_chatbot_conversations_token_idx` ON `eg_chatbot_conversations` (`token`)',
  'CREATE INDEX IF NOT EXISTS `eg_chatbot_conversations_user_idx` ON `eg_chatbot_conversations` (`user_id`)',
  `CREATE TABLE IF NOT EXISTS \`eg_chatbot_messages\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`conversation_id\` integer NOT NULL,
  \`role\` text NOT NULL DEFAULT 'user',
  \`content\` text NOT NULL DEFAULT '',
  \`via\` text NOT NULL DEFAULT '',
  \`sources\` text NOT NULL DEFAULT '[]',
  \`cost_micro\` integer NOT NULL DEFAULT 0,
  \`rating\` integer NOT NULL DEFAULT 0,
  \`created_at\` text
)`,
  'CREATE INDEX IF NOT EXISTS `eg_chatbot_messages_conv_idx` ON `eg_chatbot_messages` (`conversation_id`)',
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of CHATBOT_STATEMENTS) await db.run(sql.raw(statement))
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_site_settings'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_site_settings`)'))) as { name: string }[]
  if (!existing.some((r) => r.name === 'features_chatbot')) {
    await db.run(sql.raw('ALTER TABLE `eg_site_settings` ADD COLUMN `features_chatbot` integer DEFAULT false'))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The tables and column stay on rollback.
}
