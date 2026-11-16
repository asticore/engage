import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 23c: gift wrap switch and flat fee on globals/ShopExtraSettings.ts (`giftWrapEnabled`, `giftWrapFee`). Idempotent. Down is a no-op. */
const COLUMNS: [string, string][] = [
  ['gift_wrap_enabled', 'integer DEFAULT false'],
  ['gift_wrap_fee', 'numeric DEFAULT 0'],
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const have = new Set(((await db.all(sql.raw('PRAGMA table_info(`eg_shop_extra_settings`)'))) as { name: string }[]).map((r) => r.name))
  if (have.size === 0) return
  for (const [column, type] of COLUMNS) {
    if (!have.has(column)) await db.run(sql.raw(`ALTER TABLE \`eg_shop_extra_settings\` ADD COLUMN \`${column}\` ${type}`))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The columns stay on rollback.
}
