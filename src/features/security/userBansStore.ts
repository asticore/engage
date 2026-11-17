import { banLockUntil, BAN_MARKER, type BanRow } from './userBans'

type Stmt = { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<unknown> } }
export type D1 = { prepare: (sql: string) => Stmt }
type Row = Record<string, unknown>

export async function findUserByEmail(d1: D1, email: string): Promise<{ id: number; email: string; role: string } | null> {
  const r = (await d1.prepare('SELECT id, email FROM eg_users WHERE lower(email) = ?1').bind(email.trim().toLowerCase()).all<Row>()).results[0]
  return r ? { id: Number(r.id), email: String(r.email ?? ''), role: '' } : null
}

/** Bans: locks the account, ends every session at once, and records the reason (never shown to the banned person). */
export async function banUser(d1: D1, v: { userId: number; reason: string; days: number | null; by: string }, nowIso: string): Promise<string | null> {
  const lockUntil = banLockUntil(v.days, Date.parse(nowIso))
  await d1.prepare('UPDATE eg_users SET lock_until = ?1, login_attempts = ?2 WHERE id = ?3').bind(lockUntil, BAN_MARKER, v.userId).run()
  await d1.prepare('DELETE FROM eg_users_sessions WHERE _parent_id = ?1').bind(v.userId).run()
  const expires = v.days && v.days > 0 ? lockUntil : null
  await d1
    .prepare('INSERT INTO eg_user_bans (user_id, reason, banned_at, expires_at, banned_by) VALUES (?1,?2,?3,?4,?5) ON CONFLICT(user_id) DO UPDATE SET reason=?2, banned_at=?3, expires_at=?4, banned_by=?5')
    .bind(v.userId, v.reason, nowIso, expires, v.by)
    .run()
  return expires
}

export async function unbanUser(d1: D1, userId: number): Promise<void> {
  await d1.prepare('UPDATE eg_users SET lock_until = NULL, login_attempts = 0 WHERE id = ?1').bind(userId).run()
  await d1.prepare('DELETE FROM eg_user_bans WHERE user_id = ?1').bind(userId).run()
}

export async function listBans(d1: D1): Promise<BanRow[]> {
  const rows = (
    await d1
      .prepare('SELECT b.user_id, b.reason, b.banned_at, b.expires_at, u.email, u.name FROM eg_user_bans b LEFT JOIN eg_users u ON u.id = b.user_id ORDER BY b.banned_at DESC LIMIT 500')
      .bind()
      .all<Row>()
  ).results
  return rows.map((r) => ({ userId: Number(r.user_id), email: String(r.email ?? ''), name: String(r.name ?? ''), reason: String(r.reason ?? ''), bannedAt: String(r.banned_at ?? ''), expiresAt: r.expires_at ? String(r.expires_at) : null }))
}
