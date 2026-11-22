import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 5 (21b): what a spam rule does (hold, flag, discard) and the Akismet key on form settings. Idempotent. Down is a no-op. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_form_settings'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_form_settings`)'))) as { name: string }[]
  if (!existing.some((c) => c.name === 'spam_spam_rule_action')) await db.run(sql.raw("ALTER TABLE `eg_form_settings` ADD COLUMN `spam_spam_rule_action` text DEFAULT 'hold'"))
  if (!existing.some((c) => c.name === 'spam_akismet_key')) await db.run(sql.raw('ALTER TABLE `eg_form_settings` ADD COLUMN `spam_akismet_key` text'))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The columns stay on rollback.
}
