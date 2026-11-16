import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 26b: blocked words, link limit and blocked senders on form settings. Three columns. Idempotent. Down is a no-op. */
const COLUMNS: Array<[string, string]> = [
  ['spam_blocked_words', 'ALTER TABLE `eg_form_settings` ADD COLUMN `spam_blocked_words` text'],
  ['spam_max_links', 'ALTER TABLE `eg_form_settings` ADD COLUMN `spam_max_links` numeric DEFAULT 0'],
  ['spam_blocked_senders', 'ALTER TABLE `eg_form_settings` ADD COLUMN `spam_blocked_senders` text'],
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_form_settings'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_form_settings`)'))) as { name: string }[]
  for (const [name, ddl] of COLUMNS) if (!existing.some((c) => c.name === name)) await db.run(sql.raw(ddl))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The columns stay on rollback.
}
