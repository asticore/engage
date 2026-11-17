import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 12e leftovers: `section_routes` on each approval workflow (approvers per section). Idempotent. Down is a no-op. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const exists = (await db.all(sql.raw("SELECT name FROM sqlite_master WHERE type='table' AND name='eg_approval_workflows'"))) as { name: string }[]
  if (exists.length === 0) return
  const cols = (await db.all(sql.raw('PRAGMA table_info(`eg_approval_workflows`)'))) as { name: string }[]
  if (!cols.some((c) => c.name === 'section_routes')) await db.run(sql.raw('ALTER TABLE `eg_approval_workflows` ADD COLUMN `section_routes` text'))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The column stays on rollback.
}
