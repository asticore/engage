import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 11e: the built text of each custom product feed, so a feed reader does not trigger a full catalogue build
 * on every request. One row per feed and site address; cleared when a product or the feed changes. Idempotent. Down is a no-op.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(
    sql.raw(`CREATE TABLE IF NOT EXISTS \`eg_product_feed_cache\` (
  \`feed_id\` integer NOT NULL,
  \`origin\` text NOT NULL,
  \`content_type\` text NOT NULL,
  \`body\` text NOT NULL,
  \`built_at\` integer NOT NULL,
  PRIMARY KEY (\`feed_id\`, \`origin\`)
)`),
  )
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The table stays on rollback.
}
