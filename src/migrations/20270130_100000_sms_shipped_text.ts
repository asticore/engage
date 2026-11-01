import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

type Runner = MigrateUpArgs['db']

/**
 * Task 7b: the switch for the shipped-order text, on the Integrations row (communications > sms).
 * Off by default (DEFAULT 0), so a site that never turns it on sends no text it did not ask for.
 *
 * Idempotent: the column is added only when PRAGMA table_info says it is missing, and the step is skipped when the table is absent.
 */

const columnNames = async (db: Runner, table: string): Promise<Set<string>> => {
  const rows = (await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]
  return new Set(rows.map((row) => row.name))
}

const tableExists = async (db: Runner, table: string): Promise<boolean> =>
  ((await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name=${table}`)) as unknown[]).length > 0

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  if (await tableExists(db, 'eg_integrations')) {
    const columns = await columnNames(db, 'eg_integrations')
    if (!columns.has('communications_sms_shipped_order_text')) {
      await db.run(sql.raw('ALTER TABLE `eg_integrations` ADD COLUMN `communications_sms_shipped_order_text` integer DEFAULT 0'))
    }
  }
  engine.logger.info('[migrate] Shipped-order text switch is in place (off by default).')
}

export async function down({ engine }: MigrateDownArgs): Promise<void> {
  engine.logger.info('[migrate] Down is a no-op - the switch column is left in place.')
}
