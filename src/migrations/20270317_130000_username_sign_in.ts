import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

type Runner = MigrateUpArgs['db']

/**
 * Task 23g, username sign-in.
 *   1. `username` on eg_users: optional, stored lowercase, unique (a unique index ignores NULLs).
 *      Mirror: the `username` field in src/collections/Users.ts.
 *   2. `username_sign_in_enabled` on eg_security_settings, off by default.
 *      Mirror: `usernameSignInEnabled` in src/globals/SecuritySettings.ts.
 * Idempotent: a column or index already there is left alone. Down is a no-op.
 */

const columnsOf = async (db: Runner, table: string): Promise<string[]> => {
  try {
    const rows = (await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]
    return rows.map((r) => r.name)
  } catch {
    return []
  }
}

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  const userColumns = await columnsOf(db, 'eg_users')
  if (userColumns.length > 0) {
    if (!userColumns.includes('username')) await db.run(sql.raw('ALTER TABLE `eg_users` ADD COLUMN `username` text'))
    await db.run(sql.raw('CREATE UNIQUE INDEX IF NOT EXISTS `eg_users_username_idx` ON `eg_users` (`username`)'))
  }
  const settingColumns = await columnsOf(db, 'eg_security_settings')
  if (settingColumns.length > 0 && !settingColumns.includes('username_sign_in_enabled')) {
    await db.run(sql.raw('ALTER TABLE `eg_security_settings` ADD COLUMN `username_sign_in_enabled` integer DEFAULT 0'))
  }
  engine.logger.info('[migrate] Username sign-in columns are present.')
}

export async function down({ engine }: MigrateDownArgs): Promise<void> {
  engine.logger.info('[migrate] Down is a no-op - the username columns are left in place.')
}
