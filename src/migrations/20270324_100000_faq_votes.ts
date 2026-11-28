import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 6 (16f): "Was this helpful?" votes on FAQ answers. One row per question and visitor. Idempotent. Down is a no-op. */
export const FAQ_VOTE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_faq_votes\` (
  \`faq_id\` integer NOT NULL,
  \`voter\` text NOT NULL,
  \`helpful\` integer NOT NULL,
  \`created_at\` text NOT NULL,
  PRIMARY KEY (\`faq_id\`, \`voter\`)
)`,
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of FAQ_VOTE_STATEMENTS) await db.run(sql.raw(statement))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The table stays on rollback.
}
