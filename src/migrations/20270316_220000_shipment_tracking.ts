import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 18b: the switch for parcel tracking emails on the Shop switches global. Tracking itself is stored inside each shipment on the order. Idempotent. Down is a no-op. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const have = new Set(((await db.all(sql.raw('PRAGMA table_info(`eg_shop_extra_settings`)'))) as { name: string }[]).map((r) => r.name))
  if (have.size > 0 && !have.has('tracking_emails')) await db.run(sql.raw('ALTER TABLE `eg_shop_extra_settings` ADD COLUMN `tracking_emails` integer DEFAULT true'))
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The column stays on rollback.
}
