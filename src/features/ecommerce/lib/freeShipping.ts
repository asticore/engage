import type { ShippingZone } from './shipping'

/**
 * Free-shipping progress for the cart. The threshold is the lowest "free over amount" among the
 * enabled methods of all zones (dollars). It is a hint only: checkout still prices shipping from the
 * buyer's address with `quoteShipping`. Pure, so no database and no import cycle.
 */

export function lowestFreeThreshold(zones: readonly Pick<ShippingZone, 'methods'>[]): number | null {
  let best: number | null = null
  for (const zone of zones) {
    for (const method of zone.methods ?? []) {
      if (method.enabled === false || method.type !== 'free_over_amount') continue
      const amount = Number(method.freeOver ?? 0)
      if (Number.isFinite(amount) && amount > 0 && (best === null || amount < best)) best = amount
    }
  }
  return best
}

export type FreeShippingProgress = { reached: boolean; remaining: number; percent: number }

export function freeShippingProgress(subtotal: number, threshold: number): FreeShippingProgress {
  const spent = Number.isFinite(subtotal) && subtotal > 0 ? subtotal : 0
  const reached = spent >= threshold
  return { reached, remaining: reached ? 0 : Math.round((threshold - spent) * 100) / 100, percent: Math.min(100, Math.round((spent / threshold) * 100)) }
}
