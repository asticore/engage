import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Admin two-step on by default, sign-ins last 30 days.
 * Existing Security rows: `login_protection_require_two_factor_for_admins` goes to 1 (with a 7 day
 * grace period if none is set, so nobody is surprised), and a session length still at the old default
 * of 720 minutes becomes 43200 (30 days). Rows without a column or table are left alone. Idempotent.
 * Down is a no-op.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const cols = (await db.all(sql.raw('PRAGMA table_info(`eg_security_settings`)'))) as { name: string }[]
  const has = (name: string) => cols.some((c) => c.name === name)
  if (has('login_protection_require_two_factor_for_admins')) {
    await db.run(sql.raw('UPDATE `eg_security_settings` SET `login_protection_require_two_factor_for_admins` = 1 WHERE `login_protection_require_two_factor_for_admins` IS NOT 1'))
    if (has('two_factor_grace_ends_at')) {
      const grace = new Date(Date.now() + 7 * 86_400_000).toISOString()
      await db.run(sql.raw(`UPDATE \`eg_security_settings\` SET \`two_factor_grace_ends_at\` = '${grace}' WHERE \`two_factor_grace_ends_at\` IS NULL OR \`two_factor_grace_ends_at\` = ''`))
    }
  }
  if (has('login_protection_session_timeout_minutes')) {
    await db.run(sql.raw('UPDATE `eg_security_settings` SET `login_protection_session_timeout_minutes` = 43200 WHERE `login_protection_session_timeout_minutes` = 720'))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // Settings stay as they are on rollback.
}
