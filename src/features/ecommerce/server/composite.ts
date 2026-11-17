import { stockPool } from './stockHold'
import { resolveCartLine, type CatalogueProduct } from '../catalogue'
import type { BundleContent } from '../lib/bundles'
import { checkCompositePicks, compositeOptionCents, compositeSteps, compositeSummary, type CompositePick, type CompositeStep } from '../lib/composite'
import { toCents } from '../lib/money'
import { quantityError } from '../lib/qtyLimits'
import { effectivePrice, type PriceFields } from '../pricing'

type Doc = Record<string, unknown>
export type CompositeEngine = { findByID: (a: unknown) => Promise<Doc | null> }

export type CompositeResult =
  | { ok: true; unitCents: number; contents: BundleContent[]; summary: string; picks: CompositePick[]; weightGrams: number; pools: Array<{ key: string; available: number; quantity: number }> }
  | { ok: false; error: string }

const fail = (error: string): CompositeResult => ({ ok: false, error })

const loadChild = async (engine: CompositeEngine, productId: number): Promise<(CatalogueProduct & Doc) | null> =>
  (await engine.findByID({ collection: 'products', id: productId, depth: 0, overrideAccess: true }).catch((): null => null)) as (CatalogueProduct & Doc) | null

/**
 * Prices and checks one composite line from the database copy of the product and the picked items.
 * `reserved` holds item quantities already promised to earlier cart lines (keyed `productId:`) so two lines cannot
 * both take the last unit; it is updated when the line is ok. Picked items must be published simple products that
 * are in stock. The returned `contents` is the snapshot an order keeps, so stock and refunds follow what was picked.
 */
export async function resolveComposite(engine: CompositeEngine, product: Doc, picks: CompositePick[], quantity: number, now: Date, reserved: Map<string, number>, alreadyInCart = 0, preordersOn = true): Promise<CompositeResult> {
  if (product._status != null && product._status !== 'published') return fail('This product is not available.')
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return fail('Invalid quantity.')
  const limit = quantityError(quantity, product as { minQty?: number | null; maxQty?: number | null }, quantity + Math.max(0, alreadyInCart))
  if (limit) return fail(limit)
  const checked = checkCompositePicks(compositeSteps(product.compositeOptions, product.compositeRules), picks)
  if (!checked.ok) return fail((checked as { error: string }).error)
  const base = effectivePrice(product as PriceFields, now)
  if (base === null) return fail('This product has no price.')

  const contents: BundleContent[] = []
  const entries: Array<{ component: string; title: string }> = []
  const pending = new Map<string, number>()
  const pools = new Map<string, { available: number; quantity: number }>()
  let unitCents = toCents(base)
  let weightGrams = Math.round((typeof product.weight === 'number' ? product.weight : 0) * 1000)
  for (const { step, option } of checked.chosen) {
    const child = await loadChild(engine, option.productId)
    if (!child || (child._status != null && child._status !== 'published')) return fail(`An item for ${step.label} is not available.`)
    const title = String(child.title ?? 'Item')
    if ((child.productType ?? 'simple') !== 'simple' || child.nameYourPrice) return fail(`${title} cannot be sold in a kit.`)
    const key = `${option.productId}:`
    const needed = quantity
    const resolved = resolveCartLine(child, null, needed, now, (reserved.get(key) ?? 0) + (pending.get(key) ?? 0), null, preordersOn)
    if (!resolved.ok) return fail(`${title}: ${(resolved as { error: string }).error}`)
    if (resolved.preorder) return fail(`${title} is on pre-order and cannot be sold in a kit.`)
    pending.set(key, (pending.get(key) ?? 0) + needed)
    const pool = stockPool(child as never, null)
    if (pool) pools.set(pool.key, { available: pool.available, quantity: (pools.get(pool.key)?.quantity ?? 0) + needed })
    unitCents += compositeOptionCents(option, toCents(resolved.unitPrice))
    weightGrams += Math.round((typeof child.weight === 'number' ? child.weight : 0) * 1000)
    const existing = contents.find((c) => c.productId === option.productId)
    if (existing) existing.quantity += 1
    else contents.push({ productId: option.productId, title, quantity: 1 })
    entries.push({ component: step.label, title })
  }
  for (const [key, n] of pending) reserved.set(key, (reserved.get(key) ?? 0) + n)
  return { ok: true, unitCents, contents, summary: compositeSummary(entries), picks: checked.picks, weightGrams, pools: [...pools].map(([key, v]) => ({ key, ...v })) }
}

export type CompositeStepView = {
  label: string
  description: string
  required: boolean
  min: number
  max: number
  options: Array<{ productId: number; title: string; extraCents: number; priceMode: string; isDefault: boolean; available: boolean }>
}

/**
 * What the product page shows: the starting price (the product's own price) and the steps with each item's title,
 * what it adds to the price right now, whether it is in stock, and whether it starts picked.
 */
export async function compositeStorefront(engine: CompositeEngine, product: Doc, now: Date, preordersOn = true): Promise<{ baseCents: number | null; steps: CompositeStepView[] }> {
  const base = effectivePrice(product as PriceFields, now)
  const steps: CompositeStep[] = compositeSteps(product.compositeOptions, product.compositeRules)
  const views: CompositeStepView[] = []
  for (const step of steps) {
    const options: CompositeStepView['options'] = []
    for (const option of step.options) {
      const child = await loadChild(engine, option.productId)
      const usable = child !== null && (child._status == null || child._status === 'published') && (child.productType ?? 'simple') === 'simple' && !child.nameYourPrice
      const resolved = usable ? resolveCartLine(child, null, 1, now, 0, null, preordersOn) : null
      const ok = resolved !== null && resolved.ok && !resolved.preorder
      options.push({
        productId: option.productId,
        title: child ? String(child.title ?? 'Item') : 'Item no longer available',
        extraCents: ok ? compositeOptionCents(option, toCents((resolved as { unitPrice: number }).unitPrice)) : 0,
        priceMode: option.priceMode,
        isDefault: option.isDefault,
        available: ok,
      })
    }
    views.push({ label: step.label, description: step.description, required: step.required, min: step.min, max: step.max, options })
  }
  return { baseCents: base === null ? null : toCents(base), steps: views }
}

/** Save-time check: every item offered must be an existing simple product that is not name-your-price. */
export async function compositeItemErrors(engine: CompositeEngine, product: Doc): Promise<Array<{ path: string; message: string }>> {
  if (product.productType !== 'composite') return []
  const errors: Array<{ path: string; message: string }> = []
  const seen = new Set<number>()
  for (const step of compositeSteps(product.compositeOptions, product.compositeRules)) {
    for (const option of step.options) {
      if (seen.has(option.productId)) continue
      seen.add(option.productId)
      const child = await loadChild(engine, option.productId)
      if (!child) errors.push({ path: 'compositeOptions', message: `Product ${option.productId} offered in "${step.label}" no longer exists.` })
      else if ((child.productType ?? 'simple') !== 'simple' || child.nameYourPrice) errors.push({ path: 'compositeOptions', message: `"${String(child.title ?? 'A product')}" cannot be offered in a kit. Only simple products can.` })
    }
  }
  return errors
}
