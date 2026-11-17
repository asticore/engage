import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 14c: custom endpoint for the S3 backup destination (Backblaze B2, Wasabi, MinIO). Idempotent. Down is a no-op. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_backup_settings'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_backup_settings`)'))) as { name: string }[]
  if (!existing.some((c) => c.name === 'destination_s3_endpoint')) await db.run(sql.raw('ALTER TABLE `eg_backup_settings` ADD COLUMN `destination_s3_endpoint` text'))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The column stays on rollback.
}
