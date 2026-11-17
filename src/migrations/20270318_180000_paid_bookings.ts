import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 12b: paid bookings. A booking type has a price and a refund window; a booking records its amount, the Stripe payment, when it was paid and how much was refunded.
 * Idempotent. Down is a no-op.
 */
const COLUMNS: Record<string, [string, string][]> = {
  eg_booking_types: [
    ['price_cents', 'integer NOT NULL DEFAULT 0'],
    ['refund_hours', 'integer NOT NULL DEFAULT 24'],
  ],
  eg_bookings: [
    ['amount_cents', 'integer NOT NULL DEFAULT 0'],
    ['payment_intent_id', 'text'],
    ['paid_at', 'text'],
    ['refunded_cents', 'integer NOT NULL DEFAULT 0'],
  ],
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
