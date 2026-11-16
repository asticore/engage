import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 24h: block disposable email on member sign-up. One column on member settings. Idempotent. Down is a no-op. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_member_settings'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_member_settings`)'))) as { name: string }[]
  if (!existing.some((c) => c.name === 'registration_block_disposable_email')) {
    await db.run(sql.raw('ALTER TABLE `eg_member_settings` ADD COLUMN `registration_block_disposable_email` integer DEFAULT 0'))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The column stays on rollback.
}
