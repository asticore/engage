import { loadPricedLines, type PricingEngine } from './pricing'
import { cartHoldExpiry, holdStock, normaliseStockHold } from './stockHold'

type CartItems = Parameters<typeof loadPricedLines>[1]

/**
 * Task 23e: holds a cart's stock when the shopper opens the cart page (switch: "Also hold stock while shoppers view their cart"),
 * then returns when the earliest of the cart's holds ends, for the countdown. Checkout holds show up here too.
 * Never throws and never blocks the cart: a cart another shopper's hold covers just gets no hold (checkout still decides).
 */
export async function holdAndReadCartStock(engine: PricingEngine, cartId: number, items: CartItems, now: Date = new Date()): Promise<{ expiresAt: string | null }> {
  const db = await import('@/cms/db/connect').then((m) => m.resolveD1Binding()).catch((): null => null)
  const settings = normaliseStockHold(await engine.findGlobal({ slug: 'shop-extra-settings', depth: 0, overrideAccess: true }).catch((): null => null))
  if (!settings.enabled) return { expiresAt: null }
  if (settings.inCart && items.length > 0) {
    try {
      const lines = await loadPricedLines(engine, items, now)
      const pools = (lines as unknown as { stockPools?: Map<string, { available: number; quantity: number }> }).stockPools
      for (const [key, pool] of pools ?? []) await holdStock(db as never, cartId, key, pool.quantity, pool.available, settings.minutes, now)
    } catch {
      // A line the shop cannot supply is shown by the cart itself; there is nothing to hold for it.
    }
  }
  return { expiresAt: await cartHoldExpiry(db as never, cartId, now) }
}
