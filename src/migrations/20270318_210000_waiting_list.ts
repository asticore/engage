import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 12d: waiting list with held places. Two shop switches (how a restock is offered, hours a place is held)
 * and the hold end time on each back-in-stock sign-up. Idempotent: a column that exists is skipped, a missing
 * table is left alone (it is created whole, with these columns, when it is first needed). Down is a no-op.
 */
const COLUMNS: Record<string, [string, string][]> = {
  // Shop settings (eg_shop_settings) is at the D1 limit of 100 columns, so the two switches live on the extra settings.
  eg_shop_extra_settings: [
    ['waiting_list_mode', "text DEFAULT 'all'"],
    ['waiting_list_hold_hours', 'numeric DEFAULT 24'],
  ],
  eg_stock_subscriptions: [['hold_until', 'text']],
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
