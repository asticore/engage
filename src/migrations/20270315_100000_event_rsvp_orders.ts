import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

// Task 1: paid tickets become bookings. An RSVP now carries the shop order it was bought on (`order_id`),
// a booking status (`status`, confirmed or cancelled) and the time it was cancelled (`cancelled_at`).
// A cancelled booking frees its places. Existing rows read as confirmed through the column default.
//
// Column names are what src/cms/db/schema/generate.ts produces for rsvpStatusFields in
// src/features/editScreens/fields.ts. Change one, change both. Idempotent: a column is added only when
// PRAGMA table_info does not list it, and a missing table is skipped.

const COLUMNS: Array<[string, string]> = [
  ['status', "text DEFAULT 'confirmed'"],
  ['cancelled_at', 'text'],
  ['order_id', 'numeric'],
]

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  const rows = (await db.all(sql.raw('PRAGMA table_info(`eg_event_rsvps`)'))) as { name: string }[]
  const existing = new Set(rows.map((row) => row.name))
  if (existing.size > 0) {
    for (const [column, type] of COLUMNS) {
      if (!existing.has(column)) await db.run(sql.raw(`ALTER TABLE \`eg_event_rsvps\` ADD COLUMN \`${column}\` ${type}`))
    }
    await db.run(sql.raw('CREATE INDEX IF NOT EXISTS `eg_event_rsvps_order_id_idx` ON `eg_event_rsvps` (`order_id`)'))
  }
  engine.logger.info('[migrate] event RSVP order link and booking status ensured.')
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // SQLite cannot drop columns cheaply and the data is worth keeping, so down is a no-op.
}
