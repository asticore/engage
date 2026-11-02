import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

// Passkey sign-in and the authenticator-app code (see src/features/passkeys/core.ts).
//   1. `passkeys_skip_two_factor` on the Security global (`eg_security_settings`), off by default
//      (DEFAULT 0). When on, a passkey that performed user verification skips the two-step code.
//      When off, every passkey sign-in on a two-step account still asks for the code. Existing sites
//      that relied on the old always-skip behaviour become stricter on upgrade; that is intended.
//      Mirror: the passkeysSkipTwoFactor field in src/globals/SecuritySettings.ts.
// Idempotent: the column is added only when PRAGMA table_info says it is missing, and the step is
// skipped when the table is absent. Down is a no-op (SQLite does not drop columns).

type Runner = MigrateUpArgs['db']

const columnNames = async (db: Runner, table: string): Promise<Set<string>> => {
  const rows = (await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]
  return new Set(rows.map((row) => row.name))
}

const tableExists = async (db: Runner, table: string): Promise<boolean> =>
  ((await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name=${table}`)) as unknown[]).length > 0

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  if (await tableExists(db, 'eg_security_settings')) {
    const columns = await columnNames(db, 'eg_security_settings')
    if (!columns.has('passkeys_skip_two_factor')) {
      await db.run(sql.raw('ALTER TABLE `eg_security_settings` ADD COLUMN `passkeys_skip_two_factor` integer DEFAULT 0'))
    }
  }
  engine.logger.info('[migrate] Passkey two-step setting is in place (off: the authenticator code is always asked for).')
}

export async function down({ engine }: MigrateDownArgs): Promise<void> {
  engine.logger.info('[migrate] Down is a no-op - the column is left in place.')
}
