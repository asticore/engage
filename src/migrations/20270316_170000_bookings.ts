import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 17b, phase 1 of the Bookings plan appendix in docs/remaining-work.md: appointment bookings. Five tables owned by the `bookings` feature
 * (created only when the section is switched on, see src/features/registry.ts): booking types, resources (who or
 * what is booked, with a time zone), weekly hours, one-off overrides and the bookings. Also the `features_bookings`
 * switch on Site Settings. Idempotent. Down is a no-op.
 */
export const BOOKINGS_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_booking_resources\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`title\` text NOT NULL,
  \`time_zone\` text NOT NULL DEFAULT 'Australia/Sydney',
  \`active\` integer NOT NULL DEFAULT 1,
  \`updated_at\` text,
  \`created_at\` text
)`,
  `CREATE TABLE IF NOT EXISTS \`eg_booking_types\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`title\` text NOT NULL,
  \`slug\` text NOT NULL,
  \`description\` text NOT NULL DEFAULT '',
  \`resource_id\` integer,
  \`duration_minutes\` integer NOT NULL DEFAULT 30,
  \`step_minutes\` integer NOT NULL DEFAULT 30,
  \`buffer_before\` integer NOT NULL DEFAULT 0,
  \`buffer_after\` integer NOT NULL DEFAULT 0,
  \`min_notice_minutes\` integer NOT NULL DEFAULT 60,
  \`max_advance_days\` integer NOT NULL DEFAULT 60,
  \`capacity\` integer NOT NULL DEFAULT 1,
  \`location_text\` text NOT NULL DEFAULT '',
  \`active\` integer NOT NULL DEFAULT 1,
  \`updated_at\` text,
  \`created_at\` text
)`,
  `CREATE TABLE IF NOT EXISTS \`eg_booking_hours\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`resource_id\` integer NOT NULL,
  \`weekday\` integer NOT NULL,
  \`start_time\` text NOT NULL,
  \`end_time\` text NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS \`eg_booking_overrides\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`resource_id\` integer NOT NULL,
  \`date\` text NOT NULL,
  \`kind\` text NOT NULL,
  \`start_time\` text,
  \`end_time\` text,
  \`note\` text NOT NULL DEFAULT ''
)`,
  `CREATE TABLE IF NOT EXISTS \`eg_bookings\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`number\` text NOT NULL,
  \`type_id\` integer NOT NULL,
  \`resource_id\` integer NOT NULL,
  \`status\` text NOT NULL DEFAULT 'confirmed',
  \`start_at\` text NOT NULL,
  \`end_at\` text NOT NULL,
  \`start_ms\` integer NOT NULL,
  \`end_ms\` integer NOT NULL,
  \`units\` integer NOT NULL DEFAULT 1,
  \`time_zone\` text NOT NULL,
  \`customer_name\` text NOT NULL,
  \`customer_email\` text NOT NULL,
  \`customer_phone\` text NOT NULL DEFAULT '',
  \`notes\` text NOT NULL DEFAULT '',
  \`manage_token_hash\` text NOT NULL,
  \`cancelled_at\` text,
  \`updated_at\` text,
  \`created_at\` text
)`,
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_booking_types_slug_idx` ON `eg_booking_types` (`slug`)',
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_bookings_number_idx` ON `eg_bookings` (`number`)',
  'CREATE INDEX IF NOT EXISTS `eg_bookings_resource_idx` ON `eg_bookings` (`resource_id`, `start_ms`, `end_ms`)',
  'CREATE INDEX IF NOT EXISTS `eg_bookings_status_idx` ON `eg_bookings` (`status`, `start_ms`)',
  'CREATE INDEX IF NOT EXISTS `eg_bookings_email_idx` ON `eg_bookings` (`customer_email`)',
  'CREATE INDEX IF NOT EXISTS `eg_booking_hours_resource_idx` ON `eg_booking_hours` (`resource_id`)',
  'CREATE INDEX IF NOT EXISTS `eg_booking_overrides_resource_idx` ON `eg_booking_overrides` (`resource_id`, `date`)',
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of BOOKINGS_STATEMENTS) await db.run(sql.raw(statement))
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_site_settings'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_site_settings`)'))) as { name: string }[]
  if (!existing.some((r) => r.name === 'features_bookings')) {
    await db.run(sql.raw('ALTER TABLE `eg_site_settings` ADD COLUMN `features_bookings` integer DEFAULT false'))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The tables stay on rollback.
}
