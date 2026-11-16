import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 25a: single sign-on per organisation (OpenID Connect). Two tables owned by the `sso` feature (created only
 * when the section is switched on, see src/features/registry.ts) and the `features_sso` switch on Site Settings.
 * Idempotent. Down is a no-op.
 */
export const ORG_SSO_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_org_sso\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`org_id\` text NOT NULL,
  \`name\` text NOT NULL,
  \`issuer\` text NOT NULL,
  \`client_id\` text NOT NULL,
  \`client_secret\` text,
  \`domains\` text NOT NULL DEFAULT '[]',
  \`default_role\` text NOT NULL DEFAULT 'member',
  \`jit\` integer NOT NULL DEFAULT 1,
  \`enforce\` integer NOT NULL DEFAULT 0,
  \`enabled\` integer NOT NULL DEFAULT 0,
  \`created_at\` text,
  \`updated_at\` text
)`,
  'CREATE INDEX IF NOT EXISTS `eg_org_sso_org_idx` ON `eg_org_sso` (`org_id`)',
  `CREATE TABLE IF NOT EXISTS \`eg_org_sso_links\` (
  \`conn_id\` text NOT NULL,
  \`subject\` text NOT NULL,
  \`user_id\` integer NOT NULL,
  \`created_at\` text,
  PRIMARY KEY (\`conn_id\`, \`subject\`)
)`,
  'CREATE INDEX IF NOT EXISTS `eg_org_sso_links_user_idx` ON `eg_org_sso_links` (`user_id`)',
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of ORG_SSO_STATEMENTS) await db.run(sql.raw(statement))
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_site_settings'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_site_settings`)'))) as { name: string }[]
  if (!existing.some((r) => r.name === 'features_sso')) {
    await db.run(sql.raw('ALTER TABLE `eg_site_settings` ADD COLUMN `features_sso` integer DEFAULT false'))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The tables and column stay on rollback.
}
