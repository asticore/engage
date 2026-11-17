import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 11e: per-feed column mapping (JSON of templates) and refresh interval in minutes on `eg_product_feeds`.
 * Idempotent: a column that exists is skipped, and a missing table (shop never switched on) is left for the lazy
 * table creation, which uses the same final shape through the earlier migration plus this one. Down is a no-op.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const info = (await db.all(sql.raw('PRAGMA table_info(`eg_product_feeds`)'))) as { name: string }[]
  if (info.length === 0) return
  const have = new Set(info.map((c) => c.name))
  if (!have.has('mapping')) await db.run(sql.raw("ALTER TABLE `eg_product_feeds` ADD COLUMN `mapping` text NOT NULL DEFAULT ''"))
  if (!have.has('refresh_minutes')) await db.run(sql.raw('ALTER TABLE `eg_product_feeds` ADD COLUMN `refresh_minutes` integer NOT NULL DEFAULT 60'))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The columns stay on rollback.
}
