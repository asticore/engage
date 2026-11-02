import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

type Runner = MigrateUpArgs['db']

/**
 * Known-limits sweep (Media, Admin): two Media settings.
 *
 * - eg_media_settings.uploads_allow_svg: "Allow SVG uploads", off by default (DEFAULT 0). When on, SVG pictures are cleaned on
 *   upload (src/features/media/svgSanitise.ts) and then stored. A site that never turns it on accepts no SVG.
 * - eg_media_settings.stock_openverse_hosts: the Openverse picture host list, one host per line. Stored empty by default, which
 *   means the built-in list (src/features/media/stock.ts), so existing sites keep the same allow-list they had.
 *
 * Idempotent: each column is added only when PRAGMA table_info says it is missing, and the step is skipped when the table is absent.
 * Down is a no-op: SQLite does not drop columns, and the columns are harmless when unused.
 */

const columnNames = async (db: Runner, table: string): Promise<Set<string>> => {
  const rows = (await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]
  return new Set(rows.map((row) => row.name))
}

const tableExists = async (db: Runner, table: string): Promise<boolean> =>
  ((await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name=${table}`)) as unknown[]).length > 0

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  if (await tableExists(db, 'eg_media_settings')) {
    const columns = await columnNames(db, 'eg_media_settings')
    if (!columns.has('uploads_allow_svg')) {
      await db.run(sql.raw('ALTER TABLE `eg_media_settings` ADD COLUMN `uploads_allow_svg` integer DEFAULT false'))
    }
    if (!columns.has('stock_openverse_hosts')) {
      await db.run(sql.raw('ALTER TABLE `eg_media_settings` ADD COLUMN `stock_openverse_hosts` text'))
    }
  }
  engine.logger.info('[migrate] SVG switch and Openverse host list columns are in place (SVG off; hosts default to the built-in list).')
}

export async function down({ engine }: MigrateDownArgs): Promise<void> {
  engine.logger.info('[migrate] Down is a no-op - the columns are left in place.')
}
