import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task limits sweep (Shop): coupon uses held at checkout. One row per coupon and
 * cart that is checking out, with the time the hold ends (30 minutes). The hold is
 * taken with one conditional insert (see server/couponHold.ts), so two checkouts
 * racing for the last use cannot both get it; the row is refreshed when the same
 * cart checks out again. Idempotent: CREATE ... IF NOT EXISTS, so a fresh install
 * and an upgrade both build it and a second run changes nothing. Down is a no-op.
 */
const COUPON_RESERVATIONS = `CREATE TABLE IF NOT EXISTS \`eg_coupon_reservations\` (
  \`id\` integer PRIMARY KEY NOT NULL,
  \`coupon_code\` text NOT NULL,
  \`cart_id\` numeric NOT NULL,
  \`expires_at\` text NOT NULL,
  \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
)`

const INDEXES = [
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_coupon_reservations_code_cart_idx` ON `eg_coupon_reservations` (`coupon_code`, `cart_id`)',
  'CREATE INDEX IF NOT EXISTS `eg_coupon_reservations_code_expires_idx` ON `eg_coupon_reservations` (`coupon_code`, `expires_at`)',
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql.raw(COUPON_RESERVATIONS))
  for (const statement of INDEXES) {
    await db.run(sql.raw(statement))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // Left in place: a hold that is still running must not be lost by a rollback.
}
