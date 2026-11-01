import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task limits sweep (SEO): the 404 log. One row per address that a visitor
 * reached and got a "page not found" for: how many times, when it was last seen
 * and the last referrer. Shown on the Redirects screen as the "404s" tab, where an
 * admin can turn a row into a redirect in one click.
 *
 * Written by hand and idempotent (`CREATE TABLE IF NOT EXISTS`), so a fresh
 * install and an upgrade both build it and a second run changes nothing.
 * Down is a no-op: the table is left in place.
 */
const NOT_FOUND_LOG = `CREATE TABLE IF NOT EXISTS \`eg_not_found_log\` (
  \`id\` integer PRIMARY KEY NOT NULL,
  \`path\` text NOT NULL,
  \`hit_count\` integer DEFAULT 0 NOT NULL,
  \`last_seen\` text NOT NULL,
  \`referrer\` text,
  \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
)`

const INDEXES = [
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_not_found_log_path_idx` ON `eg_not_found_log` (`path`)',
  'CREATE INDEX IF NOT EXISTS `eg_not_found_log_last_seen_idx` ON `eg_not_found_log` (`last_seen`)',
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql.raw(NOT_FOUND_LOG))
  for (const statement of INDEXES) {
    await db.run(sql.raw(statement))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The log is left in place: dropping it would lose the 404 history.
}
