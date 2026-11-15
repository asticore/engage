/**
 * Carton and pallet quantities. Pure: no I/O, so the storefront, the cart server and the invoice share one set of rules.
 * A product can say how many units are in a carton and how many cartons on a pallet, and that it is sold only in
 * whole cartons or pallets. Quantities in the cart are always units; the step is the carton or pallet size.
 */

export type SellUnit = 'unit' | 'carton' | 'pallet'

export type Packaging = {
  unitsPerCarton?: number | null
  cartonsPerPallet?: number | null
  sellInMultiplesOf?: SellUnit | string | null
  /** When on, an off-size quantity is raised to the next full carton or pallet instead of refused. */
  roundUp?: boolean | null
  /** Fewest cartons per order. */
  minCartons?: number | null
}

const whole = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value >= 1 ? Math.floor(value) : 0)

/** Units in one carton, or 1 when the product has no carton size. */
export const cartonSize = (p: Packaging): number => whole(p.unitsPerCarton) || 1

/** Units on one pallet, or 0 when the product has no pallet size. */
export const palletSize = (p: Packaging): number => (whole(p.unitsPerCarton) && whole(p.cartonsPerPallet) ? whole(p.unitsPerCarton) * whole(p.cartonsPerPallet) : 0)

/** The step a quantity must move in: 1 unit, a carton, or a pallet. A pallet falls back to a carton when the pallet size is not set. */
export function packagingStep(p: Packaging): number {
  if (p.sellInMultiplesOf === 'pallet') return palletSize(p) || cartonSize(p)
  if (p.sellInMultiplesOf === 'carton') return cartonSize(p)
  return 1
}

/** Fewest units per order that the carton minimum asks for (0 when there is none). */
export const packagingMin = (p: Packaging): number => (whole(p.minCartons) && whole(p.unitsPerCarton) ? whole(p.minCartons) * whole(p.unitsPerCarton) : 0)

const roundUpTo = (qty: number, step: number): number => (step <= 1 ? qty : Math.ceil(qty / step) * step)

/** The quantity to use: raised to the carton minimum, and, when the product rounds up, to a full carton or pallet. */
export function normalizeQuantity(qty: number, p: Packaging): number {
  const step = packagingStep(p)
  let out = Number.isFinite(qty) ? Math.max(1, Math.trunc(qty)) : 1
  out = Math.max(out, packagingMin(p))
  return p.roundUp ? roundUpTo(out, step) : out
}

const UNIT_WORD: Record<string, string> = { carton: 'cartons', pallet: 'pallets' }

/** Plain-English reason a quantity breaks the packaging rules, or null when it is fine. */
export function packagingError(qty: number, p: Packaging): string | null {
  const step = packagingStep(p)
  const min = packagingMin(p)
  if (min > 0 && qty < min) return `You need to order at least ${whole(p.minCartons)} cartons (${min} units) of this product.`
  if (step > 1 && qty % step !== 0) {
    const word = UNIT_WORD[String(p.sellInMultiplesOf)] ?? 'cartons'
    return `This product is sold in ${word} of ${step}. Choose a quantity that is a multiple of ${step}.`
  }
  return null
}

/** "2 cartons (24 units)" for an order line, or just the unit count when the line was not sold by the carton. */
export function describeQuantity(qty: number, size: number | null | undefined): string {
  const step = whole(size)
  if (step > 1 && qty > 0 && qty % step === 0) {
    const cartons = qty / step
    return `${cartons} ${cartons === 1 ? 'carton' : 'cartons'} (${qty} units)`
  }
  return String(qty)
}

/** What the storefront stepper needs: the first quantity and the step. */
export function packagingLimits(p: Packaging, min: number): { min: number; step: number } {
  const step = packagingStep(p)
  const start = Math.max(min, packagingMin(p), step > 1 ? step : 1)
  return { min: roundUpTo(start, step), step }
}
