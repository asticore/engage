import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 17c: quote, bid and item requests. One table owned by the `quotes` feature (created only when the section is
 * switched on, see src/features/registry.ts), plus the `features_quotes` switch on Site Settings. Idempotent. Down is a no-op.
 */
export const QUOTES_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_quote_requests\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`number\` text NOT NULL,
  \`kind\` text NOT NULL DEFAULT 'quote',
  \`status\` text NOT NULL DEFAULT 'new',
  \`product_id\` integer,
  \`page_url\` text NOT NULL DEFAULT '',
  \`name\` text NOT NULL,
  \`email\` text NOT NULL,
  \`phone\` text NOT NULL DEFAULT '',
  \`quantity\` integer NOT NULL DEFAULT 1,
  \`details\` text NOT NULL DEFAULT '',
  \`deadline\` text NOT NULL DEFAULT '',
  \`offer_cents\` integer,
  \`currency\` text NOT NULL DEFAULT 'AUD',
  \`quote_lines\` text NOT NULL DEFAULT '[]',
  \`quote_total_cents\` integer,
  \`valid_until\` text,
  \`terms\` text NOT NULL DEFAULT '',
  \`token_hash\` text,
  \`order_id\` integer,
  \`counter_note\` text NOT NULL DEFAULT '',
  \`counter_cents\` integer,
  \`activity\` text NOT NULL DEFAULT '[]',
  \`updated_at\` text,
  \`created_at\` text
)`,
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_quote_requests_number_idx` ON `eg_quote_requests` (`number`)',
  'CREATE INDEX IF NOT EXISTS `eg_quote_requests_status_idx` ON `eg_quote_requests` (`status`, `created_at`)',
  'CREATE INDEX IF NOT EXISTS `eg_quote_requests_token_idx` ON `eg_quote_requests` (`token_hash`)',
  'CREATE INDEX IF NOT EXISTS `eg_quote_requests_email_idx` ON `eg_quote_requests` (`email`)',
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of QUOTES_STATEMENTS) await db.run(sql.raw(statement))
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_site_settings'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_site_settings`)'))) as { name: string }[]
  if (!existing.some((r) => r.name === 'features_quotes')) {
    await db.run(sql.raw('ALTER TABLE `eg_site_settings` ADD COLUMN `features_quotes` integer DEFAULT false'))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The table stays on rollback.
}
