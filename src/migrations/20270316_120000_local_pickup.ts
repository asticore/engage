import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 16c: local pickup locations and "ready for pickup". Columns for the fields in
 * collections/ShippingZones.ts (method `pickupLocations`), collections/Orders.ts (`readyForPickup`, `readyForPickupAt`)
 * and globals/ShopExtraSettings.ts (the ready for pickup email). Idempotent. Down is a no-op.
 */
const COLUMNS: Record<string, [string, string][]> = {
  eg_shipping_zones_methods: [['pickup_locations', 'text']],
  eg_orders: [
    ['ready_for_pickup', 'integer DEFAULT false'],
    ['ready_for_pickup_at', 'text'],
  ],
  eg_shop_extra_settings: [
    ['ready_pickup_email', 'integer DEFAULT true'],
    ['ready_pickup_subject', 'text'],
    ['ready_pickup_body', 'text'],
  ],
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const [table, cols] of Object.entries(COLUMNS)) {
    const have = new Set(((await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]).map((r) => r.name))
    if (have.size === 0) continue
    for (const [column, type] of cols) {
      if (!have.has(column)) await db.run(sql.raw(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${type}`))
    }
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The columns stay on rollback.
}
