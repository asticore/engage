import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

type Runner = MigrateUpArgs['db']

/**
 * Profile picture per user: one integer column on eg_users, `photo_id`, pointing at eg_media.
 *
 * Mirror: the `photo` field in src/collections/Users.ts. Change one, change the other.
 * Idempotent: the column is added only when missing. Registered last in src/migrations/index.ts.
 */

const columnExists = async (db: Runner, table: string, column: string): Promise<boolean> => {
  try {
    const rows = (await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]
    return rows.some((r) => r.name === column)
  } catch {
    return false
  }
}

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  if (!(await columnExists(db, 'eg_users', 'photo_id'))) {
    await db.run(sql.raw('ALTER TABLE `eg_users` ADD COLUMN `photo_id` integer REFERENCES `eg_media`(`id`) ON DELETE set null'))
  }
  engine.logger.info('[migrate] User photo column is present.')
}

export async function down({ engine }: MigrateDownArgs): Promise<void> {
  engine.logger.info('[migrate] Down is a no-op - the photo_id column is left in place.')
}
