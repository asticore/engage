import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 19i: per-webhook options for the activity log drain. One JSON column on `eg_webhooks`:
 * `{"actions":[...],"redact":[...]}` (an action filter and the fields left out of the payload).
 * Empty text means every action and no redaction, so existing webhooks behave as before. Idempotent. Down is a no-op.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_webhooks`)'))) as { name: string }[]
  if (existing.length === 0 || existing.some((c) => c.name === 'audit_options')) return
  await db.run(sql.raw("ALTER TABLE `eg_webhooks` ADD COLUMN `audit_options` text NOT NULL DEFAULT ''"))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The column stays on rollback.
}
