/**
 * Multi-level pricing (Task 4): prices by quantity ("10 to 49") and by customer type (wholesale).
 * Pure, no I/O. A tier is stored in whole shop-currency units, like `priceInAUD`, so the display
 * currency conversion (Task 3) applies to tier prices exactly as it does to normal prices.
 *
 * Customer type: member groups (Task 14) do not exist yet, so a tier's `customerType` is matched
 * against the buyer's existing roles (users.roles, for example "wholesale"). When groups arrive they
 * only need to pass their slugs in as `customerTypes`. A tier with no customer type is for everyone.
 *
 * Which tier wins: among the tiers that match the quantity, the buyer's customer types and the
 * variation, the lowest price wins, and a tier never raises the price above the normal one.
 */

export type PriceTier = {
  /** Product id as text. */
  productId: string
  /** Variation id, or null for every variation of the product. */
  variationId: string | null
  /** Buyer role or group slug this tier is for, or null for everyone. */
  customerType: string | null
  /** The tier starts at this quantity (1 or more). It runs until the next higher tier starts. */
  minQty: number
  /** Unit price in whole shop-currency units. */
  price: number
}

export const MAX_TIERS_PER_PRODUCT = 30

const clean = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim().toLowerCase().slice(0, 60) : null)

/** Reads rows from the database or the admin screen. Invalid rows are dropped. */
export function normalisePriceTiers(input: unknown): PriceTier[] {
  if (!Array.isArray(input)) return []
  const out: PriceTier[] = []
  for (const raw of input) {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const productId = r.productId ?? r.product_id
    const minQty = Number(r.minQty ?? r.min_qty)
    const price = Number(r.price)
    if (productId === null || productId === undefined || String(productId) === '') continue
    if (!Number.isInteger(minQty) || minQty < 1 || minQty > 1_000_000) continue
    if (!Number.isFinite(price) || price < 0) continue
    const variation = r.variationId ?? r.variation_id
    out.push({
      productId: String(productId),
      variationId: variation === null || variation === undefined || variation === '' ? null : String(variation),
      customerType: clean(r.customerType ?? r.customer_type),
      minQty,
      price: Math.round(price * 100) / 100,
    })
  }
  return out
}

/** The tiers for one product and variation that apply to this buyer, lowest quantity first. */
export function applicableTiers(tiers: PriceTier[], productId: string, variationId: string | null, customerTypes: string[]): PriceTier[] {
  const types = new Set(customerTypes.map((t) => t.toLowerCase()))
  return tiers
    .filter((t) => t.productId === String(productId) && (t.variationId === null || t.variationId === variationId) && (t.customerType === null || types.has(t.customerType)))
    .sort((a, b) => a.minQty - b.minQty || a.price - b.price)
}

/**
 * The unit price for `quantity`, given the normal price. Returns the normal price when no tier
 * applies. `tier` is the tier used, for the order note and the cart.
 */
export function resolveTierPrice(
  tiers: PriceTier[],
  ctx: { productId: string; variationId: string | null; quantity: number; customerTypes: string[]; basePrice: number },
): { price: number; tier: PriceTier | null } {
  let best: PriceTier | null = null
  for (const t of applicableTiers(tiers, ctx.productId, ctx.variationId, ctx.customerTypes)) {
    if (t.minQty > ctx.quantity || t.price >= ctx.basePrice) continue
    if (!best || t.price < best.price) best = t
  }
  return best ? { price: best.price, tier: best } : { price: ctx.basePrice, tier: null }
}

/** Short English notes for the product page, for example "Buy 10 or more: 8.50 each". Money is formatted by the caller. */
export function tierNotes(tiers: PriceTier[], ctx: { productId: string; variationId: string | null; customerTypes: string[]; basePrice: number }, format: (units: number) => string): string[] {
  const seen = new Set<number>()
  const notes: string[] = []
  for (const t of applicableTiers(tiers, ctx.productId, ctx.variationId, ctx.customerTypes)) {
    if (t.price >= ctx.basePrice || seen.has(t.minQty)) continue
    seen.add(t.minQty)
    notes.push(t.minQty === 1 ? `${format(t.price)} each` : `Buy ${t.minQty} or more: ${format(t.price)} each`)
  }
  return notes
}

/** Checks a product's tier list before saving. `error` is null when fine. */
export function validatePriceTiers(input: unknown): { tiers: PriceTier[]; error: string | null } {
  if (!Array.isArray(input)) return { tiers: [], error: 'The tier list is missing.' }
  if (input.length > MAX_TIERS_PER_PRODUCT) return { tiers: [], error: `A product can have up to ${MAX_TIERS_PER_PRODUCT} price tiers.` }
  const tiers = normalisePriceTiers(input)
  if (tiers.length !== input.length) return { tiers: [], error: 'Each tier needs a whole quantity of 1 or more and a price of 0 or more.' }
  const seen = new Set<string>()
  for (const t of tiers) {
    const key = `${t.variationId ?? ''}|${t.customerType ?? ''}|${t.minQty}`
    if (seen.has(key)) return { tiers: [], error: 'Two tiers have the same quantity, variation and customer type.' }
    seen.add(key)
  }
  return { tiers, error: null }
}

/** Bulk helper: a percentage off a product's normal price, rounded to cents. */
export function percentOffPrice(basePrice: number, percentOff: number): number {
  return Math.max(0, Math.round(basePrice * (1 - percentOff / 100) * 100) / 100)
}
