import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 17d: purchase limits against hoarders and bots. Two tables owned by the `limits` feature (created only when
 * the section is switched on, see src/features/registry.ts): the rules, and a log of refused attempts. Also the
 * `features_limits` switch on Site Settings. Idempotent. Down is a no-op.
 */
export const PURCHASE_LIMITS_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_purchase_limit_rules\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`title\` text NOT NULL,
  \`product_id\` integer,
  \`max_qty\` integer,
  \`window_days\` integer NOT NULL DEFAULT 0,
  \`cooldown_hours\` integer NOT NULL DEFAULT 0,
  \`require_verified\` integer NOT NULL DEFAULT 0,
  \`active\` integer NOT NULL DEFAULT 1,
  \`updated_at\` text,
  \`created_at\` text
)`,
  `CREATE TABLE IF NOT EXISTS \`eg_purchase_limit_blocks\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`rule_id\` integer,
  \`product_id\` integer,
  \`reason\` text NOT NULL,
  \`email_key\` text NOT NULL DEFAULT '',
  \`detail\` text NOT NULL DEFAULT '',
  \`created_at\` text
)`,
  'CREATE INDEX IF NOT EXISTS `eg_purchase_limit_rules_product_idx` ON `eg_purchase_limit_rules` (`product_id`)',
  'CREATE INDEX IF NOT EXISTS `eg_purchase_limit_blocks_created_idx` ON `eg_purchase_limit_blocks` (`created_at`)',
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of PURCHASE_LIMITS_STATEMENTS) await db.run(sql.raw(statement))
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_site_settings'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_site_settings`)'))) as { name: string }[]
  if (!existing.some((r) => r.name === 'features_limits')) {
    await db.run(sql.raw('ALTER TABLE `eg_site_settings` ADD COLUMN `features_limits` integer DEFAULT false'))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The tables stay on rollback.
}
