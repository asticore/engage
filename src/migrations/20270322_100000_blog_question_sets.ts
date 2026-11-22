import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 8 (27b): editable question sets for the blog builder. One small table. Idempotent. Down is a no-op. */
export const BLOG_QUESTION_SET_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_blog_question_sets\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`name\` text NOT NULL,
  \`post_type\` text NOT NULL DEFAULT '',
  \`questions\` text NOT NULL DEFAULT '[]',
  \`is_default\` integer NOT NULL DEFAULT 0,
  \`created_at\` text
)`,
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of BLOG_QUESTION_SET_STATEMENTS) await db.run(sql.raw(statement))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The table stays on rollback.
}
