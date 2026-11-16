import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 29g: per role and per company storage quotas, kept as a JSON list on the asset manager settings row. Idempotent. Down is a no-op. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_media_dam_settings`)'))) as { name: string }[]
  if (existing.length === 0) return
  if (!existing.some((c) => c.name === 'quotas_json')) {
    await db.run(sql.raw("ALTER TABLE `eg_media_dam_settings` ADD COLUMN `quotas_json` text NOT NULL DEFAULT '[]'"))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The column stays on rollback.
}
