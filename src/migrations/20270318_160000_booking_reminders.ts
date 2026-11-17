import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 12b: booking reminders. `reminder_sent_at` on a booking records that its reminder email went out.
 * Idempotent. Down is a no-op.
 */
const COLUMNS: Record<string, [string, string][]> = {
  eg_bookings: [['reminder_sent_at', 'text']],
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const [table, cols] of Object.entries(COLUMNS)) {
    const have = new Set(((await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]).map((r) => r.name))
    if (have.size === 0) continue
    for (const [column, type] of cols) {
      if (!have.has(column)) await db.run(sql.raw(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${type}`))
    }
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The columns stay on rollback.
}
