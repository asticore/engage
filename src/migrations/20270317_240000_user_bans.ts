import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 19e: the ban record (reason, expiry, who). The block itself rides on the user's sign-in lock. Idempotent. Down is a no-op. */
export const USER_BAN_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_user_bans\` (
  \`user_id\` integer PRIMARY KEY NOT NULL,
  \`reason\` text NOT NULL DEFAULT '',
  \`banned_at\` text,
  \`expires_at\` text,
  \`banned_by\` text NOT NULL DEFAULT ''
)`,
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of USER_BAN_STATEMENTS) await db.run(sql.raw(statement))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The table stays on rollback.
}
