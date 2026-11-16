import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 31c and 31e: a private dashboard link for each affiliate (`token`), plus automatic approval and the
 * program terms text in the affiliate settings. The affiliate tables exist only once the Affiliates section has been
 * switched on, so each step is skipped when its table is not there yet. Idempotent. Down is a no-op.
 */
const STEPS: Array<{ table: string; column: string; ddl: string }> = [
  { table: 'eg_affiliates', column: 'token', ddl: "ALTER TABLE `eg_affiliates` ADD COLUMN `token` text NOT NULL DEFAULT ''" },
  { table: 'eg_affiliate_settings', column: 'auto_approve', ddl: 'ALTER TABLE `eg_affiliate_settings` ADD COLUMN `auto_approve` integer NOT NULL DEFAULT 0' },
  { table: 'eg_affiliate_settings', column: 'terms', ddl: "ALTER TABLE `eg_affiliate_settings` ADD COLUMN `terms` text NOT NULL DEFAULT ''" },
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const step of STEPS) {
    const tables = (await db.all(sql.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name='${step.table}'`))) as { name: string }[]
    if (tables.length === 0) continue
    const existing = (await db.all(sql.raw(`PRAGMA table_info(\`${step.table}\`)`))) as { name: string }[]
    if (!existing.some((c) => c.name === step.column)) await db.run(sql.raw(step.ddl))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The columns stay on rollback.
}
