import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task limits sweep (Consent): the cookie banner logo can be a picture from the
 * media library. A new column on the Integrations table holds the picked media
 * item (`consent_logo_id`, as generateTable names an upload field in the consent
 * group). The older path field stays and is used when no picture is picked.
 *
 * Idempotent: the column is added only when missing, so a fresh install (where the
 * schema has it already) and an upgrade both succeed, and a second run changes
 * nothing. Down is a no-op.
 */
const columnExists = async (db: MigrateUpArgs['db'], table: string, column: string): Promise<boolean> => {
  try {
    const rows = (await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]
    return rows.some((r) => r.name === column)
  } catch {
    return false
  }
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_integrations'`)) as { name: string }[]
  if (tables.length === 0) return
  if (!(await columnExists(db, 'eg_integrations', 'consent_logo_id'))) {
    await db.run(sql.raw('ALTER TABLE `eg_integrations` ADD COLUMN `consent_logo_id` integer'))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // SQLite keeps the column on rollback; the value is simply unused.
}
