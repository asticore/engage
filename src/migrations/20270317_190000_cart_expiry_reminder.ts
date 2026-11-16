import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 23e: the cart expiry reminder (`cartExpiryReminderDays` on ShopExtraSettings, `expiryReminderAt` on carts). Idempotent. Down is a no-op. */
async function addColumn(db: MigrateUpArgs['db'], table: string, column: string, ddl: string): Promise<void> {
  const have = new Set(((await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]).map((r) => r.name))
  if (have.size === 0 || have.has(column)) return
  await db.run(sql.raw(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${ddl}`))
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await addColumn(db, 'eg_shop_extra_settings', 'cart_expiry_reminder_days', 'numeric DEFAULT 0')
  await addColumn(db, 'eg_carts', 'expiry_reminder_at', 'text')
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The columns stay on rollback.
}
