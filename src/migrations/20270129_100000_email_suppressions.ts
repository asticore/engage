import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

// Creates `eg_email_suppressions`, the list of addresses that must not get reminder or
// marketing mail (see src/features/email/suppression.ts). Written by hand and idempotent:
// `CREATE TABLE IF NOT EXISTS` keeps a replay on a database that already has it harmless.
// Mirror: src/cms/db/schema/emailSuppressions.ts. Change one, change the other.

const EMAIL_SUPPRESSIONS_TABLE = `CREATE TABLE IF NOT EXISTS \`eg_email_suppressions\` (
  \`email\` text PRIMARY KEY NOT NULL,
  \`reason\` text NOT NULL,
  \`source\` text,
  \`created_at\` text NOT NULL
)`

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  await db.run(sql.raw(EMAIL_SUPPRESSIONS_TABLE))
  engine.logger.info('[migrate] eg_email_suppressions is present.')
}

export async function down({ engine }: MigrateDownArgs): Promise<void> {
  // No-op, like the other hand-written migrations: the list is what stops mail to people who opted out.
  engine.logger.info('[migrate] Down is a no-op - the suppression list is left in place.')
}
