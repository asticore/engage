import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Taskboard: card archive (`archived_at`) and the due date a reminder was last sent for (`due_notified`), so each
 * due date is reminded once. Skipped when the taskboard tables are not there. Idempotent. Down is a no-op.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_task_cards'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_task_cards`)'))) as { name: string }[]
  if (!existing.some((c) => c.name === 'archived_at')) await db.run(sql.raw('ALTER TABLE `eg_task_cards` ADD COLUMN `archived_at` text'))
  if (!existing.some((c) => c.name === 'due_notified')) await db.run(sql.raw('ALTER TABLE `eg_task_cards` ADD COLUMN `due_notified` text'))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The columns stay on rollback.
}
