import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

type Runner = MigrateUpArgs['db']

/**
 * Task 16e, shop address. One text column on SEO settings (group `permalinks`, field `shopBase`):
 *   `permalinks_shop_base` on eg_seo_settings, default 'shop'. Mirror: `permalinks.shopBase` in
 *   src/globals/SeoSettings.ts and src/cms/db/globals/seoSettings.ts.
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

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  const columns = await columnsOf(db, 'eg_seo_settings')
  if (columns.length > 0 && !columns.includes('permalinks_shop_base')) {
    await db.run(sql.raw("ALTER TABLE `eg_seo_settings` ADD COLUMN `permalinks_shop_base` text DEFAULT 'shop'"))
  }
  engine.logger.info('[migrate] Shop address column is present.')
}

export async function down({ engine }: MigrateDownArgs): Promise<void> {
  engine.logger.info('[migrate] Down is a no-op - the shop address column is left in place.')
}
