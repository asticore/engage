import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 13a leftovers: the wording of the five failed payment emails is editable (Members, Emails). Idempotent. Down is a no-op. */
const COLUMNS: Array<{ table: string; column: string; ddl: string }> = [
  { table: 'eg_member_settings', column: 'emails_dunning_failed_subject', ddl: "ALTER TABLE `eg_member_settings` ADD COLUMN `emails_dunning_failed_subject` text" },
  { table: 'eg_member_settings', column: 'emails_dunning_failed_body', ddl: "ALTER TABLE `eg_member_settings` ADD COLUMN `emails_dunning_failed_body` text" },
  { table: 'eg_member_settings', column: 'emails_dunning_retry_subject', ddl: "ALTER TABLE `eg_member_settings` ADD COLUMN `emails_dunning_retry_subject` text" },
  { table: 'eg_member_settings', column: 'emails_dunning_retry_body', ddl: "ALTER TABLE `eg_member_settings` ADD COLUMN `emails_dunning_retry_body` text" },
  { table: 'eg_member_settings', column: 'emails_dunning_ended_subject', ddl: "ALTER TABLE `eg_member_settings` ADD COLUMN `emails_dunning_ended_subject` text" },
  { table: 'eg_member_settings', column: 'emails_dunning_ended_body', ddl: "ALTER TABLE `eg_member_settings` ADD COLUMN `emails_dunning_ended_body` text" },
  { table: 'eg_member_settings', column: 'emails_dunning_downgraded_subject', ddl: "ALTER TABLE `eg_member_settings` ADD COLUMN `emails_dunning_downgraded_subject` text" },
  { table: 'eg_member_settings', column: 'emails_dunning_downgraded_body', ddl: "ALTER TABLE `eg_member_settings` ADD COLUMN `emails_dunning_downgraded_body` text" },
  { table: 'eg_member_settings', column: 'emails_dunning_recovered_subject', ddl: "ALTER TABLE `eg_member_settings` ADD COLUMN `emails_dunning_recovered_subject` text" },
  { table: 'eg_member_settings', column: 'emails_dunning_recovered_body', ddl: "ALTER TABLE `eg_member_settings` ADD COLUMN `emails_dunning_recovered_body` text" },
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const { table, column, ddl } of COLUMNS) {
    const exists = (await db.all(sql.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`))) as { name: string }[]
    if (exists.length === 0) continue
    const cols = (await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]
    if (!cols.some((c) => c.name === column)) await db.run(sql.raw(ddl))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The columns stay on rollback.
}
