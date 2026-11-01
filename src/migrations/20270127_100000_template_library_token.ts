import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

type Runner = MigrateUpArgs['db']

/**
 * Template libraries: an access token for private GitHub folders (task 2b, later slice).
 * Adds the encrypted `token` column to eg_template_libraries, then copies the token saved under the old
 * Integrations > Template repositories group, so a private repository that worked before keeps working.
 * The value is copied as stored (already encrypted with the same key), and only when the new column is empty.
 *
 * Replayable: the column is added only when missing, and the copy only fills an empty value.
 */

const columnExists = async (db: Runner, table: string, column: string): Promise<boolean> => {
  const rows = (await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]
  return rows.some((row) => row.name === column)
}

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  if (!(await columnExists(db, 'eg_template_libraries', 'token'))) {
    await db.run(sql.raw('ALTER TABLE `eg_template_libraries` ADD COLUMN `token` text'))
  }
  if ((await columnExists(db, 'eg_integrations', 'template_repos_token')) && (await columnExists(db, 'eg_template_libraries', 'token'))) {
    await db.run(sql.raw(`UPDATE \`eg_template_libraries\` SET \`token\` = (
      SELECT i.\`template_repos_token\` FROM \`eg_integrations\` i
      WHERE COALESCE(i.\`template_repos_token\`, '') <> '' ORDER BY i.\`id\` LIMIT 1
    ) WHERE \`id\` = 1 AND COALESCE(\`token\`, '') = ''`))
  }
  engine.logger.info('[migrate] Template library token column is present.')
}

export async function down({ engine }: MigrateDownArgs): Promise<void> {
  // No-op: the column is left in place, as the other template library migrations do.
  engine.logger.info('[migrate] Down is a no-op - template library token column is left in place.')
}
