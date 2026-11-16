import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 29a: media folders as records. The folder table made for the asset manager already holds colour, description,
 * allowed roles, alt prefix, default licence and visibility; this adds the companies a folder is limited to. Idempotent.
 * Down is a no-op.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_media_folders`)'))) as { name: string }[]
  if (existing.length === 0) return
  if (!existing.some((c) => c.name === 'allowed_companies')) {
    await db.run(sql.raw("ALTER TABLE `eg_media_folders` ADD COLUMN `allowed_companies` text NOT NULL DEFAULT ''"))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The column stays on rollback.
}
