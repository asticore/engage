import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 19a: a CAPTCHA mode per place plus the failure threshold and window on form settings. Idempotent. Down is a no-op. */
const PLACES = ['sign_in', 'register', 'reset', 'reset_confirm', 'passwordless_request', 'passwordless_verify', 'comments', 'chatbot', 'reviews', 'back_in_stock', 'rsvp', 'offline_order']

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_form_settings'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_form_settings`)'))) as { name: string }[]
  const has = (name: string): boolean => existing.some((c) => c.name === name)
  for (const place of PLACES) {
    const column = `spam_mode_${place}`
    if (!has(column)) await db.run(sql.raw(`ALTER TABLE \`eg_form_settings\` ADD COLUMN \`${column}\` text DEFAULT 'default'`))
  }
  if (!has('spam_failure_threshold')) await db.run(sql.raw('ALTER TABLE `eg_form_settings` ADD COLUMN `spam_failure_threshold` numeric DEFAULT 3'))
  if (!has('spam_failure_window_minutes')) await db.run(sql.raw('ALTER TABLE `eg_form_settings` ADD COLUMN `spam_failure_window_minutes` numeric DEFAULT 15'))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The columns stay on rollback.
}
