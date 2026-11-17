import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 12e leftovers: `review_due_days` on each approval workflow (days a review may wait before it is overdue). Idempotent. Down is a no-op. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const exists = (await db.all(sql.raw("SELECT name FROM sqlite_master WHERE type='table' AND name='eg_approval_workflows'"))) as { name: string }[]
  if (exists.length === 0) return
  const cols = (await db.all(sql.raw('PRAGMA table_info(`eg_approval_workflows`)'))) as { name: string }[]
  if (!cols.some((c) => c.name === 'review_due_days')) await db.run(sql.raw('ALTER TABLE `eg_approval_workflows` ADD COLUMN `review_due_days` numeric'))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The column stays on rollback.
}
