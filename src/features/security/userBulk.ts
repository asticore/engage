/**
 * Bulk user actions (Task 19f), pure parts. Staff and member accounts only: shop customers (role `customer`) are never
 * touched in bulk because of their personal data. Admins are never banned, demoted or signed out in bulk, and the person
 * running the action is always skipped, so a bulk run cannot lock the site out.
 */
import { MAX_BAN_DAYS } from './userBans'

export const MAX_USER_BULK = 100
export const USER_BULK_ACTIONS = ['ban', 'unban', 'revokeSessions', 'setRole'] as const
export type UserBulkAction = (typeof USER_BULK_ACTIONS)[number]
export const BULK_ASSIGNABLE_ROLES = ['editor', 'viewer'] as const

export type UserBulkRequest =
  | { ok: true; action: UserBulkAction; ids: number[]; reason: string; days: number | null; role: string }
  | { ok: false; error: string }

export function parseUserBulk(body: unknown): UserBulkRequest {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const action = USER_BULK_ACTIONS.find((a) => a === b.action)
  if (!action) return { ok: false, error: 'Unknown action.' }
  const raw = Array.isArray(b.ids) ? b.ids : []
  const ids = Array.from(new Set(raw.map((v) => Math.floor(Number(v))).filter((n) => Number.isFinite(n) && n > 0)))
  if (ids.length === 0) return { ok: false, error: 'Select at least one user.' }
  if (ids.length > MAX_USER_BULK) return { ok: false, error: `Select at most ${MAX_USER_BULK} users at a time.` }
  const days = b.days === '' || b.days == null ? null : Math.floor(Number(b.days))
  if (days !== null && (!Number.isFinite(days) || days < 1 || days > MAX_BAN_DAYS)) return { ok: false, error: `Days must be from 1 to ${MAX_BAN_DAYS}, or empty for a permanent ban.` }
  const role = typeof b.role === 'string' ? b.role : ''
  if (action === 'setRole' && !(BULK_ASSIGNABLE_ROLES as readonly string[]).includes(role)) return { ok: false, error: 'Choose editor or viewer.' }
  return { ok: true, action, ids, reason: typeof b.reason === 'string' ? b.reason.trim().slice(0, 300) : '', days, role }
}

/** Why a row is skipped, or null when the action may run on it. */
export function userBulkRefusal(action: UserBulkAction, user: { id: number; roles: string[] }, actorId: number): string | null {
  if (user.id === actorId) return 'You cannot do this to your own account.'
  if (user.roles.includes('customer') || user.roles.length === 0) return 'Shop customers cannot be changed in bulk.'
  if (action !== 'unban' && user.roles.includes('admin')) return 'Admins cannot be changed in bulk.'
  return null
}
