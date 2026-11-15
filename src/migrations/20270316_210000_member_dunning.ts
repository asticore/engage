import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 18a: dunning for failed membership payments. Settings (retry days, grace days, end action) on the Members
 * global and the chase state on each membership. Idempotent. Down is a no-op.
 */
const COLUMNS: Array<{ table: string; column: string; ddl: string }> = [
  { table: 'eg_member_settings', column: 'billing_dunning_retry_days', ddl: "ALTER TABLE `eg_member_settings` ADD COLUMN `billing_dunning_retry_days` text DEFAULT '1,3,5,7'" },
  { table: 'eg_member_settings', column: 'billing_dunning_grace_days', ddl: 'ALTER TABLE `eg_member_settings` ADD COLUMN `billing_dunning_grace_days` numeric DEFAULT 10' },
  { table: 'eg_member_settings', column: 'billing_dunning_end_action', ddl: "ALTER TABLE `eg_member_settings` ADD COLUMN `billing_dunning_end_action` text DEFAULT 'expire'" },
  { table: 'eg_memberships', column: 'dunning_started_at', ddl: 'ALTER TABLE `eg_memberships` ADD COLUMN `dunning_started_at` text' },
  { table: 'eg_memberships', column: 'dunning_attempts', ddl: 'ALTER TABLE `eg_memberships` ADD COLUMN `dunning_attempts` numeric DEFAULT 0' },
  { table: 'eg_memberships', column: 'dunning_next_at', ddl: 'ALTER TABLE `eg_memberships` ADD COLUMN `dunning_next_at` text' },
  { table: 'eg_memberships', column: 'grace_ends_at', ddl: 'ALTER TABLE `eg_memberships` ADD COLUMN `grace_ends_at` text' },
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
