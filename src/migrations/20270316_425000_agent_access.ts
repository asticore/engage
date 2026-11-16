import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 25d: AI agent access. Two tables owned by the `agents` feature (created only when the section is switched on,
 * see src/features/registry.ts) and the `features_agents` switch on Site Settings. Idempotent. Down is a no-op.
 * A grant marks one API key (eg_api_keys.id) as an agent token and holds its daily caps; every request an agent
 * makes is one row in eg_agent_actions.
 */
export const AGENT_ACCESS_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_agent_grants\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`key_id\` integer NOT NULL,
  \`label\` text NOT NULL,
  \`tool\` text NOT NULL DEFAULT '',
  \`daily_write_cap\` integer NOT NULL DEFAULT 0,
  \`daily_read_cap\` integer NOT NULL DEFAULT 0,
  \`created_by\` integer,
  \`created_at\` text,
  \`revoked_at\` text
)`,
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_agent_grants_key_idx` ON `eg_agent_grants` (`key_id`)',
  `CREATE TABLE IF NOT EXISTS \`eg_agent_actions\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`grant_id\` integer NOT NULL,
  \`key_id\` integer NOT NULL,
  \`at\` text NOT NULL,
  \`day\` text NOT NULL,
  \`kind\` text NOT NULL DEFAULT 'other',
  \`method\` text NOT NULL DEFAULT '',
  \`path\` text NOT NULL DEFAULT '',
  \`outcome\` text NOT NULL DEFAULT 'allowed'
)`,
  'CREATE INDEX IF NOT EXISTS `eg_agent_actions_grant_day_idx` ON `eg_agent_actions` (`grant_id`, `day`)',
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of AGENT_ACCESS_STATEMENTS) await db.run(sql.raw(statement))
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_site_settings'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_site_settings`)'))) as { name: string }[]
  if (!existing.some((r) => r.name === 'features_agents')) {
    await db.run(sql.raw('ALTER TABLE `eg_site_settings` ADD COLUMN `features_agents` integer DEFAULT false'))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The tables and column stay on rollback.
}
