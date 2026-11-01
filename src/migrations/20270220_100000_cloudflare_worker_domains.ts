import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

// Connect domain (features/domains/cloudflareAttach.ts): the Cloudflare account ID and the Worker name are two new
// fields in the Cloudflare group of the integrations global, so they need two columns. Idempotent: a column that is
// already there counts as success (SQLite has no ADD COLUMN IF NOT EXISTS). Registered in src/migrations/index.ts.

type Runner = MigrateUpArgs['db']

const addColumn = async (db: Runner, table: string, column: string, type: string): Promise<void> => {
  try {
    await db.run(sql.raw(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${type}`))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!/duplicate column name/i.test(message)) throw error
  }
}

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  await addColumn(db, 'eg_integrations', 'cloudflare_account_id', 'text')
  await addColumn(db, 'eg_integrations', 'cloudflare_worker_name', 'text')
  engine.logger.info('[migrate] Cloudflare account ID and Worker name columns are present.')
}

export async function down({ engine }: MigrateDownArgs): Promise<void> {
  engine.logger.info('[migrate] Down is a no-op - the Cloudflare account and Worker columns are left in place.')
}
