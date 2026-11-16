import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 24a: challenge on member sign-in, register and forgot password. One column on form settings. Idempotent. Down is a no-op. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_form_settings'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_form_settings`)'))) as { name: string }[]
  if (!existing.some((c) => c.name === 'spam_protect_sign_in')) await db.run(sql.raw('ALTER TABLE `eg_form_settings` ADD COLUMN `spam_protect_sign_in` integer DEFAULT 0'))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The column stays on rollback.
}
