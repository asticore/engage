/** Cart lifetime (Task 23e): how many days an untouched guest cart is kept before the clean-up job deletes it. */

export const DEFAULT_CART_LIFETIME_DAYS = 30

export function normaliseCartLifetime(doc: unknown): number {
  const d = (doc ?? {}) as { cartLifetimeDays?: unknown }
  const n = typeof d.cartLifetimeDays === 'number' && Number.isFinite(d.cartLifetimeDays) ? Math.trunc(d.cartLifetimeDays) : DEFAULT_CART_LIFETIME_DAYS
  return Math.min(365, Math.max(1, n))
}

/** Days before a guest cart is deleted that its owner gets a reminder email. 0 means off. Never more than 14, and always less than the lifetime. */
export function normaliseExpiryReminderDays(doc: unknown, lifetimeDays: number): number {
  const d = (doc ?? {}) as { cartExpiryReminderDays?: unknown }
  const n = typeof d.cartExpiryReminderDays === 'number' && Number.isFinite(d.cartExpiryReminderDays) ? Math.trunc(d.cartExpiryReminderDays) : 0
  return Math.min(14, lifetimeDays - 1, Math.max(0, n))
}

/** True once a cart has been idle long enough to be in its last `remindDays` days, and has not been deleted yet. */
export function expiryReminderDue(input: { updatedAt: string; lifetimeDays: number; remindDays: number; now: Date; alreadySent?: string | null }): boolean {
  if (input.remindDays <= 0 || input.alreadySent) return false
  const idleMs = input.now.getTime() - new Date(input.updatedAt).getTime()
  if (!Number.isFinite(idleMs)) return false
  const day = 24 * 3_600_000
  return idleMs >= (input.lifetimeDays - input.remindDays) * day && idleMs < input.lifetimeDays * day
}
