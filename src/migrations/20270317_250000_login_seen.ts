import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 19g: devices and countries each account has signed in from, for new-sign-in emails. Idempotent. Down is a no-op. */
export const LOGIN_SEEN_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_login_seen\` (
  \`user_id\` integer NOT NULL,
  \`device\` text NOT NULL,
  \`country\` text NOT NULL DEFAULT '',
  \`first_seen\` text,
  \`last_seen\` text,
  PRIMARY KEY (\`user_id\`, \`device\`, \`country\`)
)`,
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of LOGIN_SEEN_STATEMENTS) await db.run(sql.raw(statement))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The table stays on rollback.
}
