import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

type Runner = MigrateUpArgs['db']

/**
 * Blog builder, later slices (task 2a): the brand voice and the saved prompts on the Integrations global,
 * and a draft key on each AI usage row so one post's calls can be counted against its own limit.
 * Columns only: the saved prompts are one JSON text value, written by the blog builder's prompts route.
 *
 * Idempotent: a column is only added when missing, and each step is skipped when its table is absent.
 */

const addColumn = async (db: Runner, table: string, column: string, type: string): Promise<void> => {
  try {
    await db.run(sql.raw(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${type}`))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!/duplicate column name/i.test(message)) throw error
  }
}

const tableExists = async (db: Runner, table: string): Promise<boolean> => {
  const rows = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name=${table}`)) as { name: string }[]
  return rows.length > 0
}

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  if (await tableExists(db, 'eg_integrations')) {
    await addColumn(db, 'eg_integrations', 'blog_brand_voice', 'text')
    await addColumn(db, 'eg_integrations', 'blog_saved_prompts', 'text')
  }
  if (await tableExists(db, 'ai_builder_usage')) {
    await addColumn(db, 'ai_builder_usage', 'draft_key', 'text')
    await db.run(sql.raw('CREATE INDEX IF NOT EXISTS `ai_builder_usage_draft_key_idx` ON `ai_builder_usage` (`draft_key`)'))
  }
  engine.logger.info('[migrate] Blog builder brand voice, saved prompts and draft key are present.')
}

export async function down({ engine }: MigrateDownArgs): Promise<void> {
  engine.logger.info('[migrate] Down is a no-op - blog builder settings columns are left in place.')
}
