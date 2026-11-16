import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 28b: mini cart settings on globals/ShopExtraSettings.ts (`cartAction`, `cartOpenOnAdd`). Idempotent. Down is a no-op.
 */
const COLUMNS: Record<string, [string, string][]> = {
  eg_shop_extra_settings: [
    ['cart_action', "text DEFAULT 'page'"],
    ['cart_open_on_add', 'integer DEFAULT true'],
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
