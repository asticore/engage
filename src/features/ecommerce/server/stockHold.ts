/**
 * Optional stock hold while a cart is in checkout (Task 23e).
 *
 * Same idea as the coupon hold (couponHold.ts): one conditional INSERT ... SELECT written only while
 * the stock still free after the holds other carts have running covers this cart's quantity. D1 runs one
 * statement at a time, so two checkouts racing for the last item cannot both get a row. A hold lasts the
 * configured minutes; the same cart checking out again refreshes its own hold; a hold whose cart has since been
 * paid no longer counts (the sale already took the stock). Expired rows are swept by the cron job.
 */

import { PAID_STATUSES } from '../lib/orderStatus'

type Statement = { bind(...values: unknown[]): { run(): Promise<{ meta?: { changes?: number } }> } }
type Db = { prepare(sql: string): Statement }

export const DEFAULT_STOCK_HOLD_MINUTES = 15

export type StockHoldSettings = { enabled: boolean; minutes: number; inCart: boolean }

export function normaliseStockHold(doc: unknown): StockHoldSettings {
  const d = (doc ?? {}) as { stockHoldEnabled?: unknown; stockHoldMinutes?: unknown; stockHoldInCart?: unknown }
  const minutes = typeof d.stockHoldMinutes === 'number' && Number.isFinite(d.stockHoldMinutes) ? Math.min(240, Math.max(1, Math.trunc(d.stockHoldMinutes))) : DEFAULT_STOCK_HOLD_MINUTES
  return { enabled: d.stockHoldEnabled === true, minutes, inCart: d.stockHoldEnabled === true && d.stockHoldInCart === true }
}

/** The stock a line draws on: the variation's own when it manages stock, else the product's. Null when nothing is counted or backorders are allowed. */
export function stockPool(product: { id?: unknown; manageStock?: boolean | null; stockQty?: number | null; backorders?: string | null; variations?: unknown }, variationId: string | null): { key: string; available: number } | null {
  const rows = Array.isArray(product.variations) ? (product.variations as Array<{ id?: string; manageStock?: boolean | null; stockQty?: number | null; backorders?: string | null }>) : []
  const variation = variationId ? rows.find((v) => v.id === variationId) : undefined
  const source = variation?.manageStock ? variation : product.manageStock ? product : null
  if (!source || source.backorders === 'yes' || source.backorders === 'notify') return null
  const available = typeof source.stockQty === 'number' && Number.isFinite(source.stockQty) ? Math.trunc(source.stockQty) : 0
  return { key: variation?.manageStock ? `${String(product.id)}:${variationId}` : `${String(product.id)}:`, available }
}

/** true when held (or refreshed), false when other carts hold too much of it, null when the database is unreachable. */
export async function holdStock(db: Db | null, cartId: number, poolKey: string, quantity: number, available: number, minutes: number, now: Date = new Date()): Promise<boolean | null> {
  if (!db || !Number.isInteger(cartId) || !Number.isInteger(quantity) || quantity < 1) return null
  const nowIso = now.toISOString()
  const expiresIso = new Date(now.getTime() + minutes * 60_000).toISOString()
  const paid = PAID_STATUSES.map((status) => `'${status}'`).join(', ')
  try {
    const result = await db
      .prepare(
        'INSERT INTO eg_stock_reservations (pool_key, cart_id, quantity, expires_at, created_at) ' +
          'SELECT ?, ?, ?, ?, ? ' +
          'WHERE ? - COALESCE((SELECT SUM(r.quantity) FROM eg_stock_reservations r WHERE r.pool_key = ? AND r.expires_at > ? AND r.cart_id <> ? ' +
          `AND NOT EXISTS (SELECT 1 FROM eg_orders o WHERE o.cart_id = r.cart_id AND o.status IN (${paid}))), 0) >= ? ` +
          'ON CONFLICT (pool_key, cart_id) DO UPDATE SET quantity = excluded.quantity, expires_at = excluded.expires_at',
      )
      .bind(poolKey, cartId, quantity, expiresIso, nowIso, available, poolKey, nowIso, cartId, quantity)
      .run()
    return (result.meta?.changes ?? 0) > 0
  } catch {
    return null
  }
}

/** Deletes holds that ended before `now`. Returns how many went. */
export async function sweepStockHolds(db: { prepare(sql: string): { bind(...v: unknown[]): { run(): Promise<{ meta?: { changes?: number } }> } } } | null, now: Date = new Date()): Promise<number> {
  if (!db) return 0
  try {
    const result = await db.prepare('DELETE FROM eg_stock_reservations WHERE expires_at <= ?').bind(now.toISOString()).run()
    return result.meta?.changes ?? 0
  } catch {
    return 0
  }
}

/** The earliest end among a cart's live holds, or null when it holds nothing. For the shopper's countdown. */
export async function cartHoldExpiry(db: { prepare(sql: string): { bind(...v: unknown[]): { first<T>(): Promise<T | null> } } } | null, cartId: number, now: Date = new Date()): Promise<string | null> {
  if (!db || !Number.isInteger(cartId)) return null
  try {
    const row = await db.prepare('SELECT MIN(expires_at) AS at FROM eg_stock_reservations WHERE cart_id = ? AND expires_at > ?').bind(cartId, now.toISOString()).first<{ at: string | null }>()
    return row?.at ?? null
  } catch {
    return null
  }
}
