/** Cart lifetime (Task 23e): how many days an untouched guest cart is kept before the clean-up job deletes it. */

export const DEFAULT_CART_LIFETIME_DAYS = 30

export function normaliseCartLifetime(doc: unknown): number {
  const d = (doc ?? {}) as { cartLifetimeDays?: unknown }
  const n = typeof d.cartLifetimeDays === 'number' && Number.isFinite(d.cartLifetimeDays) ? Math.trunc(d.cartLifetimeDays) : DEFAULT_CART_LIFETIME_DAYS
  return Math.min(365, Math.max(1, n))
}
