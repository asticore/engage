import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 12d leftovers: a message editable per purchase limit rule, and an exceptions list of trusted customers
 * (emails, one per line) the rule never refuses. Idempotent. Down is a no-op.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_purchase_limit_rules'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_purchase_limit_rules`)'))) as { name: string }[]
  if (!existing.some((r) => r.name === 'message')) await db.run(sql.raw("ALTER TABLE `eg_purchase_limit_rules` ADD COLUMN `message` text NOT NULL DEFAULT ''"))
  if (!existing.some((r) => r.name === 'exempt_emails')) await db.run(sql.raw("ALTER TABLE `eg_purchase_limit_rules` ADD COLUMN `exempt_emails` text NOT NULL DEFAULT ''"))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The columns stay on rollback.
}
