import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 8c: setting locks for the visual builder and the email builder. One row per lock: where it applies
 * (`scope`, `target`), what it locks (`groups`, `keys`, both JSON lists) and who may still change it
 * (`unlock_roles`, a JSON list of role slugs). Admins always may. Idempotent. Down is a no-op.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(
    sql.raw(`CREATE TABLE IF NOT EXISTS \`eg_setting_locks\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`scope\` text NOT NULL,
  \`target\` text NOT NULL DEFAULT '',
  \`groups\` text NOT NULL DEFAULT '[]',
  \`keys\` text NOT NULL DEFAULT '[]',
  \`unlock_roles\` text NOT NULL DEFAULT '[]',
  \`updated_at\` text,
  \`created_at\` text
)`),
  )
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The table stays on rollback.
}
