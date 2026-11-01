import { MigrateUpArgs, sql } from '@/engine/db'

/**
 * Approval workflows: `allow_repeat_approver` on eg_approval_workflows. When it is on, one person who
 * holds the approver role of two steps may approve both in one review round (the default keeps them to
 * one step, so the two reviews are separate people). See src/features/approval/handlers.ts.
 *
 * Idempotent: the column is added only when it is missing, so a fresh install (where the schema already
 * has it) and an upgrade both succeed, and a second run changes nothing. Down is a no-op.
 */

const columnExists = async (db: MigrateUpArgs['db'], table: string, column: string): Promise<boolean> => {
  try {
    const rows = (await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]
    return rows.some((row) => row.name === column)
  } catch {
    return false
  }
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await columnExists(db, 'eg_approval_workflows', 'allow_repeat_approver'))) {
    await db.run(sql.raw('ALTER TABLE `eg_approval_workflows` ADD COLUMN `allow_repeat_approver` integer DEFAULT false'))
  }
}

export async function down(): Promise<void> {
  // SQLite does not support DROP COLUMN; the column is left in place.
}
