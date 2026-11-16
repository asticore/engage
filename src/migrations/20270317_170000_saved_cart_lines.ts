import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 23c: saved for later lines that follow a signed-in shopper across devices (see features/ecommerce/server/savedLines.ts).
 * One row per user, product and variation. Idempotent: CREATE ... IF NOT EXISTS. Down is a no-op.
 */
const TABLE = `CREATE TABLE IF NOT EXISTS \`eg_saved_cart_lines\` (
  \`id\` integer PRIMARY KEY NOT NULL,
  \`user_id\` numeric NOT NULL,
  \`product_id\` numeric NOT NULL,
  \`variation\` text DEFAULT '' NOT NULL,
  \`quantity\` integer DEFAULT 1 NOT NULL,
  \`title\` text DEFAULT '' NOT NULL,
  \`note\` text,
  \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
)`
const INDEXES = ['CREATE UNIQUE INDEX IF NOT EXISTS `eg_saved_cart_lines_user_product_idx` ON `eg_saved_cart_lines` (`user_id`, `product_id`, `variation`)']

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql.raw(TABLE))
  for (const statement of INDEXES) await db.run(sql.raw(statement))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The table stays on rollback.
}
