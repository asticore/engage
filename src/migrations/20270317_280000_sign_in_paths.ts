import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

type Runner = MigrateUpArgs['db']

/**
 * Task 19l, customer and member sign-in URLs. One text column each, empty meaning the default path:
 *   `customer_sign_in_path` on eg_security_settings. Mirror: `customerSignInPath` in src/globals/SecuritySettings.ts.
 *   `sign_in_path` on eg_member_settings (the Security table is at the 100 column limit). Mirror: `signInPath`
 *   in src/globals/MemberSettings.ts.
 * Idempotent: a column already there, or a table not created yet, is left alone. Down is a no-op.
 */

const columnsOf = async (db: Runner, table: string): Promise<string[]> => {
  try {
    const rows = (await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]
    return rows.map((r) => r.name)
  } catch {
    return []
  }
}

const ensure = async (db: Runner, table: string, column: string): Promise<void> => {
  const columns = await columnsOf(db, table)
  if (columns.length > 0 && !columns.includes(column)) {
    await db.run(sql.raw(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` text`))
  }
}

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  await ensure(db, 'eg_security_settings', 'customer_sign_in_path')
  await ensure(db, 'eg_member_settings', 'sign_in_path')
  engine.logger.info('[migrate] Sign-in URL columns are present.')
}

export async function down({ engine }: MigrateDownArgs): Promise<void> {
  engine.logger.info('[migrate] Down is a no-op - the sign-in URL columns are left in place.')
}
