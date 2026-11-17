import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 19a and 19k follow-ups: an admin sign-in CAPTCHA mode and a per-form bot detection override. Idempotent. Down is a no-op. */
async function addColumn(db: MigrateUpArgs['db'], table: string, column: string, ddl: string): Promise<void> {
  const tables = (await db.all(sql.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`))) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]
  if (!existing.some((c) => c.name === column)) await db.run(sql.raw(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${ddl}`))
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await addColumn(db, 'eg_form_settings', 'spam_mode_admin_sign_in', "text DEFAULT 'default'")
  await addColumn(db, 'eg_form_settings', 'spam_mode_card_checkout', "text DEFAULT 'default'")
  await addColumn(db, 'eg_forms', 'spam_bot_detection', "text DEFAULT 'inherit'")
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The columns stay on rollback.
}
