import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

// Webhooks: log redaction, the retention setting, and inbound webhooks (see src/features/webhooks).
//   1. `eg_webhook_deliveries.redacted`: 1 when secret-looking content was replaced in the stored body
//      once the delivery finished (src/features/webhooks/redact.ts). Existing rows default to 0.
//   2. `eg_webhook_settings`, one row (id 1): the log retention in days (7 to 365, default 30).
//   3. `eg_webhook_inbound`, one row per inbound endpoint: a public token (the address segment), the
//      encrypted HMAC secret, what it does (create a page or post, or trigger an event), the title
//      field, draft or published, the replay window and on/off.
//   4. `eg_webhook_inbound_log`, one row per request that reached an endpoint: the idempotency key
//      (unique per endpoint, so a repeat is a duplicate), the outcome and a short reason. Never the body.
// Idempotent: IF NOT EXISTS everywhere, and the column add is checked first because SQLite has no
// `ADD COLUMN IF NOT EXISTS`. Mirror: src/cms/db/schema/webhooks.ts.

export const DELIVERY_REDACTED_COLUMN = '`redacted` integer DEFAULT 0 NOT NULL'

export const SETTINGS_TABLE = `CREATE TABLE IF NOT EXISTS \`eg_webhook_settings\` (
  \`id\` integer PRIMARY KEY NOT NULL,
  \`retention_days\` integer DEFAULT 30 NOT NULL,
  \`updated_at\` text NOT NULL
)`

export const INBOUND_TABLE = `CREATE TABLE IF NOT EXISTS \`eg_webhook_inbound\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`name\` text NOT NULL,
  \`description\` text DEFAULT '' NOT NULL,
  \`token\` text NOT NULL,
  \`secret\` text NOT NULL,
  \`action\` text NOT NULL,
  \`collection\` text,
  \`title_path\` text DEFAULT '' NOT NULL,
  \`status\` text DEFAULT 'draft' NOT NULL,
  \`event\` text,
  \`window_seconds\` integer DEFAULT 300 NOT NULL,
  \`enabled\` integer DEFAULT 1 NOT NULL,
  \`created_at\` text NOT NULL,
  \`updated_at\` text NOT NULL
)`

export const INBOUND_LOG_TABLE = `CREATE TABLE IF NOT EXISTS \`eg_webhook_inbound_log\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`endpoint_id\` integer NOT NULL,
  \`idempotency_key\` text,
  \`outcome\` text NOT NULL,
  \`reason\` text,
  \`result\` text,
  \`created_at\` text NOT NULL,
  \`updated_at\` text NOT NULL
)`

export const INDEXES = [
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_webhook_inbound_token_idx` ON `eg_webhook_inbound` (`token`)',
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_webhook_inbound_log_key_idx` ON `eg_webhook_inbound_log` (`endpoint_id`, `idempotency_key`)',
  'CREATE INDEX IF NOT EXISTS `eg_webhook_inbound_log_endpoint_idx` ON `eg_webhook_inbound_log` (`endpoint_id`, `created_at`)',
]

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  const columnsOf = async (table: string): Promise<Set<string>> => {
    const rows = (await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]
    return new Set(rows.map((row) => row.name))
  }

  // SQLite has no ADD COLUMN IF NOT EXISTS, so the column is checked first.
  const deliveryColumns = await columnsOf('eg_webhook_deliveries')
  if (deliveryColumns.size > 0 && !deliveryColumns.has('redacted')) {
    await db.run(sql.raw(`ALTER TABLE \`eg_webhook_deliveries\` ADD ${DELIVERY_REDACTED_COLUMN}`))
  }

  await db.run(sql.raw(SETTINGS_TABLE))
  await db.run(sql.raw(INBOUND_TABLE))
  await db.run(sql.raw(INBOUND_LOG_TABLE))
  for (const statement of INDEXES) {
    await db.run(sql.raw(statement))
  }
  engine.logger.info('[migrate] Webhook redaction, retention and inbound tables are present.')
}

export async function down({ engine }: MigrateDownArgs): Promise<void> {
  // No-op like the other migrations: the tables and the column are left in place.
  engine.logger.info('[migrate] Down is a no-op - webhook inbound tables are left in place.')
}
