import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 26b (affiliates): commission rates per product tag (new table). A product with its own rate still wins; otherwise the
 * highest rate among its tags applies. Idempotent. Down is a no-op.
 */
export const AFFILIATE_TAG_RATE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_affiliate_tag_rates\` (
  \`tag_id\` integer PRIMARY KEY NOT NULL,
  \`rate_pct\` real NOT NULL DEFAULT 0,
  \`updated_at\` text
)`,
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of AFFILIATE_TAG_RATE_STATEMENTS) await db.run(sql.raw(statement))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The table stays on rollback.
}
