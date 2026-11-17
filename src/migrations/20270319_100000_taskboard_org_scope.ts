import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 18j: a taskboard board can belong to a company and, optionally, one of its team. Adds nullable
 * `organization_id` and `team_id` to `eg_task_boards` (only when the table exists, it is created when the
 * Taskboard section is switched on). Idempotent. Down is a no-op.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const cols = (await db.all(sql.raw('PRAGMA table_info(`eg_task_boards`)'))) as { name: string }[]
  if (cols.length === 0) return
  for (const name of ['organization_id', 'team_id']) {
    if (!cols.some((c) => c.name === name)) await db.run(sql.raw(`ALTER TABLE \`eg_task_boards\` ADD COLUMN \`${name}\` text`))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The columns stay on rollback.
}
