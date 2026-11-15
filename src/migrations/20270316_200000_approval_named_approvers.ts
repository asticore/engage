import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 17e: approval steps can name people. `approver_users` and `also_roles` on each workflow step, and
 * `author_routes` on the workflow (a different approver per author). Idempotent. Down is a no-op.
 */
const COLUMNS: Array<{ table: string; column: string; ddl: string }> = [
  { table: 'eg_approval_workflows_steps', column: 'approver_users', ddl: 'ALTER TABLE `eg_approval_workflows_steps` ADD COLUMN `approver_users` text' },
  { table: 'eg_approval_workflows_steps', column: 'also_roles', ddl: 'ALTER TABLE `eg_approval_workflows_steps` ADD COLUMN `also_roles` integer DEFAULT false' },
  { table: 'eg_approval_workflows', column: 'author_routes', ddl: 'ALTER TABLE `eg_approval_workflows` ADD COLUMN `author_routes` text' },
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
