/**
 * Holds one use of a coupon for a checkout, atomically.
 *
 * The hold is a single conditional INSERT ... SELECT ... WHERE: it is written only
 * while the coupon's paid uses plus the holds still running (other carts, not yet
 * paid) are below the usage limit. D1 runs one statement at a time, so two checkouts
 * racing for the last use cannot both get a row. A hold lasts COUPON_RESERVATION_MS
 * (30 minutes); the same cart checking out again refreshes its own hold, and a hold
 * whose cart has since been paid does not count any more (the paid use does).
 */

import { PAID_STATUSES } from '../lib/orderStatus'

export const COUPON_HOLD_MS = 30 * 60_000

type Statement = { bind(...values: unknown[]): { run(): Promise<{ meta?: { changes?: number } }> } }
type Db = { prepare(sql: string): Statement }

/**
 * true when the hold was taken (or refreshed), false when the limit is already
 * reached, and null when the database is not reachable (the caller then keeps the
 * softer check it already made).
 */
export async function holdCouponUse(db: Db | null, code: string, cartId: number, limit: number, now: Date = new Date()): Promise<boolean | null> {
  if (!db || !Number.isFinite(limit) || limit <= 0 || !Number.isInteger(cartId)) return null
  const nowIso = now.toISOString()
  const expiresIso = new Date(now.getTime() + COUPON_HOLD_MS).toISOString()
  const paid = PAID_STATUSES.map((status) => `'${status}'`).join(', ')
  try {
    const result = await db
      .prepare(
        'INSERT INTO eg_coupon_reservations (coupon_code, cart_id, expires_at, created_at) ' +
          'SELECT ?, ?, ?, ? ' +
          'WHERE (SELECT COALESCE(usage_count, 0) FROM eg_coupons WHERE code = ?) + ' +
          '(SELECT COUNT(*) FROM eg_coupon_reservations r WHERE r.coupon_code = ? AND r.expires_at > ? AND r.cart_id <> ? ' +
          `AND NOT EXISTS (SELECT 1 FROM eg_orders o WHERE o.cart_id = r.cart_id AND o.status IN (${paid}))) < ? ` +
          'ON CONFLICT (coupon_code, cart_id) DO UPDATE SET expires_at = excluded.expires_at',
      )
      .bind(code, cartId, expiresIso, nowIso, code, code, nowIso, cartId, limit)
      .run()
    return (result.meta?.changes ?? 0) > 0
  } catch {
    return null
  }
}
