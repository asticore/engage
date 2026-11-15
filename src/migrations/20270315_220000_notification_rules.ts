import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 8: notification rules (Email > Notifications). One row per rule: what starts it (`event`),
 * how it is sent (`channel`: email or push), who gets it, and the wording with merge tags.
 * Also the web push tables: `eg_push_config` (the site's VAPID key pair, private key encrypted, one row) and
 * `eg_push_subscriptions` (one row per browser that turned push on). Idempotent. Down is a no-op.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(
    sql.raw(`CREATE TABLE IF NOT EXISTS \`eg_notification_rules\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`name\` text NOT NULL,
  \`event\` text NOT NULL,
  \`channel\` text NOT NULL DEFAULT 'email',
  \`recipient\` text NOT NULL DEFAULT 'admin',
  \`custom_to\` text NOT NULL DEFAULT '',
  \`subject\` text NOT NULL DEFAULT '',
  \`body\` text NOT NULL DEFAULT '',
  \`enabled\` integer NOT NULL DEFAULT 1,
  \`updated_at\` text,
  \`created_at\` text
)`),
  )
  await db.run(
    sql.raw(`CREATE TABLE IF NOT EXISTS \`eg_push_config\` (
  \`id\` integer PRIMARY KEY NOT NULL,
  \`public_key\` text NOT NULL,
  \`private_key\` text NOT NULL,
  \`created_at\` text
)`),
  )
  await db.run(
    sql.raw(`CREATE TABLE IF NOT EXISTS \`eg_push_subscriptions\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`endpoint\` text NOT NULL,
  \`p256dh\` text NOT NULL,
  \`auth\` text NOT NULL,
  \`user_id\` integer,
  \`created_at\` text
)`),
  )
  await db.run(sql.raw('CREATE UNIQUE INDEX IF NOT EXISTS `eg_push_subscriptions_endpoint_idx` ON `eg_push_subscriptions` (`endpoint`)'))
  await db.run(sql.raw('CREATE INDEX IF NOT EXISTS `eg_notification_rules_event_idx` ON `eg_notification_rules` (`event`)'))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The table stays on rollback.
}
