import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 19j: the guided CSP builder (one config row) and its violation log. Idempotent. Down is a no-op. */
export const CSP_BUILDER_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_csp_builder\` (
  \`id\` integer PRIMARY KEY NOT NULL,
  \`config\` text NOT NULL DEFAULT '{}',
  \`updated_at\` text
)`,
  `CREATE TABLE IF NOT EXISTS \`eg_csp_reports\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`directive\` text NOT NULL,
  \`blocked\` text NOT NULL,
  \`page\` text NOT NULL DEFAULT '',
  \`disposition\` text NOT NULL DEFAULT 'enforce',
  \`hits\` integer NOT NULL DEFAULT 1,
  \`first_seen\` text,
  \`last_seen\` text
)`,
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_csp_reports_key_idx` ON `eg_csp_reports` (`directive`, `blocked`)',
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of CSP_BUILDER_STATEMENTS) await db.run(sql.raw(statement))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The tables stay on rollback.
}
