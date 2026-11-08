import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

// Fresh-install questionnaire (see src/features/setup/questionnaire.ts).
//   1. `setup_questionnaire` json column on Site Settings (`eg_site_settings`). NULL means the owner
//      has not been asked yet, so the admin dashboard offers the questions.
//   2. An install that already has a Site Settings row is never prompted: where the column is NULL it
//      is set to a "skipped" record with reason existing-install. A fresh install has no row yet, so
//      it keeps NULL and sees the questionnaire.
//      Mirror: the setupQuestionnaire field in src/globals/SiteSettings.ts.
// Idempotent: the column is added only when PRAGMA table_info says it is missing, the backfill only
// touches NULL values, and the whole step is skipped when the table is absent. Down is a no-op.

type Runner = MigrateUpArgs['db']

const columnNames = async (db: Runner, table: string): Promise<Set<string>> => {
  const rows = (await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]
  return new Set(rows.map((row) => row.name))
}

const tableExists = async (db: Runner, table: string): Promise<boolean> =>
  ((await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name=${table}`)) as unknown[]).length > 0

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  if (await tableExists(db, 'eg_site_settings')) {
    const columns = await columnNames(db, 'eg_site_settings')
    if (!columns.has('setup_questionnaire')) {
      await db.run(sql.raw('ALTER TABLE `eg_site_settings` ADD COLUMN `setup_questionnaire` text'))
    }
    const skipped = JSON.stringify({ status: 'skipped', completedAt: new Date().toISOString(), reason: 'existing-install' })
    await db.run(sql`UPDATE \`eg_site_settings\` SET \`setup_questionnaire\` = ${skipped} WHERE \`setup_questionnaire\` IS NULL`)
  }
  engine.logger.info('[migrate] Setup questionnaire column is in place (existing sites are not asked).')
}

export async function down({ engine }: MigrateDownArgs): Promise<void> {
  engine.logger.info('[migrate] Down is a no-op - the column is left in place.')
}
