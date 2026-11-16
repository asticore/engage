import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 31d: outbound click counters for external and affiliate products (one row per product, source and day, no visitor identifier). Idempotent. Down is a no-op. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(
    sql.raw(
      'CREATE TABLE IF NOT EXISTS `eg_outbound_clicks` (`product_id` integer NOT NULL, `source` text NOT NULL, `day` text NOT NULL, `clicks` integer NOT NULL DEFAULT 0, PRIMARY KEY (`product_id`, `source`, `day`))',
    ),
  )
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The table stays on rollback.
}
