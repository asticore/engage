import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 19b: admin-editable per-route rate limit rules, read by the middleware. Idempotent. Down is a no-op. */
export const RATE_RULE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_rate_rules\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`path_prefix\` text NOT NULL,
  \`method\` text NOT NULL DEFAULT 'ANY',
  \`max_requests\` integer NOT NULL,
  \`window_seconds\` integer NOT NULL DEFAULT 60,
  \`note\` text NOT NULL DEFAULT '',
  \`enabled\` integer NOT NULL DEFAULT 1,
  \`created_at\` text
)`,
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of RATE_RULE_STATEMENTS) await db.run(sql.raw(statement))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The table stays on rollback.
}
