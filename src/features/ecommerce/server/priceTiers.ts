/**
 * Reads and writes price tiers (table eg_shop_price_tiers). Server only. Reads never throw into a
 * page: a missing table means "no tiers", so pricing falls back to the normal price.
 */
import { normalisePriceTiers, type PriceTier } from '../lib/priceTiers'

type D1 = { prepare: (sql: string) => { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<unknown> } } }

const COLUMNS = 'product_id, variation_id, customer_type, min_qty, price'

export async function listPriceTiers(d1: D1, productIds?: string[]): Promise<PriceTier[]> {
  try {
    if (productIds && productIds.length === 0) return []
    const where = productIds ? ` WHERE product_id IN (${productIds.map((_, i) => `?${i + 1}`).join(', ')})` : ''
    const rows = (await d1.prepare(`SELECT ${COLUMNS} FROM eg_shop_price_tiers${where} ORDER BY product_id, min_qty`).bind(...(productIds ?? [])).all<Record<string, unknown>>()).results
    return normalisePriceTiers(rows)
  } catch {
    return []
  }
}

/** Replaces every tier of one product with the validated list. */
export async function savePriceTiers(d1: D1, productId: string, tiers: PriceTier[], now: Date): Promise<void> {
  await d1.prepare('DELETE FROM eg_shop_price_tiers WHERE product_id = ?1').bind(productId).run()
  for (const t of tiers) {
    await d1
      .prepare('INSERT INTO eg_shop_price_tiers (product_id, variation_id, customer_type, min_qty, price, updated_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)')
      .bind(productId, t.variationId ?? '', t.customerType ?? '', t.minQty, t.price, now.toISOString())
      .run()
  }
}
