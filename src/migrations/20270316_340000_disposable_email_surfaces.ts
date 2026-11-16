import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 24h: disposable email blocking for customer accounts, forms and checkout. Three columns on member settings. Idempotent. Down is a no-op. */
const COLUMNS = ['registration_block_disposable_customers', 'registration_block_disposable_forms', 'registration_block_disposable_checkout']

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_member_settings'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_member_settings`)'))) as { name: string }[]
  for (const name of COLUMNS) {
    if (!existing.some((c) => c.name === name)) await db.run(sql.raw(`ALTER TABLE \`eg_member_settings\` ADD COLUMN \`${name}\` integer DEFAULT 0`))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The columns stay on rollback.
}
