import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 23e: last login method and time on the user record. Idempotent. Down is a no-op. */
const COLUMNS: Array<[string, string]> = [
  ['last_login_method', 'text'],
  ['last_login_at', 'text'],
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_users'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_users`)'))) as { name: string }[]
  for (const [name, type] of COLUMNS) {
    if (!existing.some((c) => c.name === name)) await db.run(sql.raw(`ALTER TABLE \`eg_users\` ADD COLUMN \`${name}\` ${type}`))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The columns stay on rollback.
}
