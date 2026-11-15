import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 8: SMTP as an email provider and an ordered fallback list. New columns on the
 * Email settings table: `fallback_order` and the `smtp_*` group
 * (host, port, security, username, password). Idempotent: each column is added only when missing.
 * Down is a no-op.
 */
const COLUMNS: [string, string][] = [
  ['fallback_order', 'text'],
  ['smtp_host', 'text'],
  ['smtp_port', 'numeric'],
  ['smtp_security', 'text'],
  ['smtp_username', 'text'],
  ['smtp_password', 'text'],
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_email_settings'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_email_settings`)'))) as { name: string }[]
  const have = new Set(existing.map((r) => r.name))
  for (const [name, type] of COLUMNS) {
    if (!have.has(name)) await db.run(sql.raw(`ALTER TABLE \`eg_email_settings\` ADD COLUMN \`${name}\` ${type}`))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // SQLite keeps the columns on rollback; the values are simply unused.
}
