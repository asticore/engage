/**
 * Ban and unban users (Task 19e), pure parts. A ban rides on the existing sign-in lock: `lockUntil` is the expiry (or
 * the far future for a permanent ban) and `loginAttempts` holds a marker that no automatic lockout can reach, so the sign-in
 * code can tell a ban from a lockout and show a neutral message without the reason. An expired ban lifts itself, because an
 * expired lock already does.
 */

export const BAN_MARKER = 100_000
export const BAN_FOREVER = '9999-12-31T00:00:00.000Z'
export const BAN_MESSAGE = 'This account cannot sign in.'
export const MAX_BAN_DAYS = 3650

export function banLockUntil(days: number | null | undefined, now = Date.now()): string {
  if (days === null || days === undefined || !Number.isFinite(days) || days <= 0) return BAN_FOREVER
  return new Date(now + Math.min(MAX_BAN_DAYS, Math.floor(days)) * 86_400_000).toISOString()
}

/** True while the account is banned (a ban marker and a lock that has not run out). */
export function isBanned(row: { lockUntil?: string | null; loginAttempts?: number | null }, now = Date.now()): boolean {
  return (row.loginAttempts ?? 0) >= BAN_MARKER && Boolean(row.lockUntil) && new Date(row.lockUntil as string).getTime() > now
}

export type BanRow = { userId: number; email: string; name: string; reason: string; bannedAt: string; expiresAt: string | null }
