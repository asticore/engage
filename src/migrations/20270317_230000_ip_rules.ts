import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 19c: the IP allow and block list. One small table read by the middleware. Idempotent. Down is a no-op. */
export const IP_RULE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_ip_rules\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`kind\` text NOT NULL DEFAULT 'block',
  \`entry\` text NOT NULL,
  \`reason\` text NOT NULL DEFAULT '',
  \`expires_at\` text,
  \`created_at\` text
)`,
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_ip_rules_entry_idx` ON `eg_ip_rules` (`kind`, `entry`)',
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of IP_RULE_STATEMENTS) await db.run(sql.raw(statement))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The table stays on rollback.
}
