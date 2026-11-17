/**
 * Composite products ("build your own kit"): a product of type "composite" with steps (components). For each
 * step the buyer picks one or more items from a list. Pure, no I/O. The database side (loading the picked
 * products, stock, price) lives in server/composite.ts.
 *
 * Admin data is two flat lists, so no nested tables are needed:
 *  - `compositeOptions`: one row per item the buyer can pick, with the step it belongs to (`component`).
 *  - `compositeRules`: optional, one row per step name, with the help text and the rules (required, min, max).
 * A step with no rules row is required and takes exactly one item.
 *
 * Price: the product's own price (regular, with its sale schedule) plus what each picked item adds. An item is
 * "included" (adds nothing), "add" (adds a set price, or its own price when no amount is set) or "discount"
 * (adds its own price less a percentage). Stock, tax and weight come from the picked products.
 */

export type CompositePriceMode = 'included' | 'add' | 'discount'

export const COMPOSITE_MAX_STEPS = 12
export const COMPOSITE_MAX_OPTIONS = 80

export type CompositeOptionRow = { component?: unknown; product?: unknown; priceMode?: unknown; priceValue?: unknown; isDefault?: unknown }
export type CompositeRuleRow = { component?: unknown; description?: unknown; required?: unknown; minChoices?: unknown; maxChoices?: unknown }

export type CompositeOption = { productId: number; priceMode: CompositePriceMode; priceValue: number | null; isDefault: boolean }
export type CompositeStep = { label: string; description: string; required: boolean; min: number; max: number; options: CompositeOption[] }

/** What the buyer picked for one step, as sent by the page and stored on the cart line (`c` step label, `p` product id). */
export type CompositePick = { component: string; productId: number }

const isId = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0

const idOfRow = (value: unknown): number | null => {
  if (isId(value)) return value
  if (value && typeof value === 'object' && 'id' in value && isId((value as { id: unknown }).id)) return (value as { id: number }).id
  return null
}

const labelOf = (value: unknown): string => (typeof value === 'string' ? value.trim().slice(0, 120) : '')
const keyOf = (label: string): string => label.toLowerCase()

export const compositePriceModeOf = (value: unknown): CompositePriceMode => (value === 'add' || value === 'discount' ? value : 'included')

const wholeOrNull = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : null)

/**
 * The steps of a composite product, in the order they first appear in the options list. Options with no product
 * or no step name are dropped; the same product listed twice in a step is merged. Rules are matched by step name
 * (ignoring case). A required step takes at least `minChoices` (default 1); an optional step takes none. The most
 * a step takes is `maxChoices` (default 1), never below the minimum and never above the number of items on offer.
 */
export function compositeSteps(optionRows: unknown, ruleRows: unknown): CompositeStep[] {
  const rules = new Map<string, CompositeRuleRow>()
  for (const rule of (Array.isArray(ruleRows) ? ruleRows : []) as CompositeRuleRow[]) {
    const label = labelOf(rule?.component)
    if (label && !rules.has(keyOf(label))) rules.set(keyOf(label), rule)
  }
  const steps = new Map<string, CompositeStep>()
  for (const row of (Array.isArray(optionRows) ? optionRows : []) as CompositeOptionRow[]) {
    const label = labelOf(row?.component)
    const productId = idOfRow(row?.product)
    if (!label || productId === null) continue
    let step = steps.get(keyOf(label))
    if (!step) {
      step = { label, description: '', required: true, min: 1, max: 1, options: [] }
      steps.set(keyOf(label), step)
    }
    if (step.options.some((option) => option.productId === productId)) continue
    const mode = compositePriceModeOf(row.priceMode)
    const value = typeof row.priceValue === 'number' && Number.isFinite(row.priceValue) && row.priceValue >= 0 ? row.priceValue : null
    step.options.push({ productId, priceMode: mode, priceValue: value, isDefault: row.isDefault === true })
  }
  for (const [key, step] of steps) {
    const rule = rules.get(key)
    const required = rule ? rule.required !== false : true
    const min = required ? Math.max(1, wholeOrNull(rule?.minChoices) ?? 1) : 0
    const max = Math.max(min, wholeOrNull(rule?.maxChoices) ?? 1, 1)
    step.required = required
    step.description = labelOf(rule?.description) ? String(rule?.description).trim().slice(0, 300) : ''
    step.min = Math.min(min, step.options.length)
    step.max = Math.min(max, step.options.length)
  }
  return [...steps.values()]
}

/** Reads the picks sent by the page or stored on a cart line (a JSON string or a list of { c, p } or { component, productId }). */
export function parseCompositePicks(raw: unknown): CompositePick[] {
  let data: unknown = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(data)) return []
  const out: CompositePick[] = []
  for (const row of data.slice(0, COMPOSITE_MAX_OPTIONS) as Array<Record<string, unknown>>) {
    const component = labelOf(row?.c ?? row?.component)
    const productId = idOfRow(row?.p ?? row?.productId ?? row?.product)
    if (!component || productId === null) continue
    if (out.some((pick) => keyOf(pick.component) === keyOf(component) && pick.productId === productId)) continue
    out.push({ component, productId })
  }
  return out
}

/** The JSON text kept on a cart line. Null when nothing was picked. */
export const storeCompositePicks = (picks: CompositePick[]): string | null => (picks.length > 0 ? JSON.stringify(picks.map((pick) => ({ c: pick.component, p: pick.productId }))) : null)

/** What one picked item adds to the price of one product, in whole cents. `itemCents` is the item's own current price. */
export function compositeOptionCents(option: Pick<CompositeOption, 'priceMode' | 'priceValue'>, itemCents: number): number {
  if (option.priceMode === 'included') return 0
  if (option.priceMode === 'add') return option.priceValue === null ? itemCents : Math.round(option.priceValue * 100)
  const pct = Math.min(100, Math.max(0, option.priceValue ?? 0))
  return Math.round((itemCents * (100 - pct)) / 100)
}

export type CompositeChosen = { step: CompositeStep; option: CompositeOption }

export type CompositeCheck = { ok: true; chosen: CompositeChosen[]; picks: CompositePick[] } | { ok: false; error: string }

/**
 * Checks the picks against the steps. A step the buyer left empty takes its default items (the ones marked
 * default, up to the most the step allows) so a line added without the page still makes a sensible kit. Picks for a
 * step or item that is not on offer, too few, or too many are refused with a message the buyer can act on.
 */
export function checkCompositePicks(steps: CompositeStep[], picks: CompositePick[]): CompositeCheck {
  if (steps.length === 0) return { ok: false, error: 'This product has no choices set up yet.' }
  for (const pick of picks) {
    const step = steps.find((s) => keyOf(s.label) === keyOf(pick.component))
    if (!step) return { ok: false, error: `"${pick.component}" is not a choice for this product.` }
    if (!step.options.some((option) => option.productId === pick.productId)) return { ok: false, error: `That item is not on offer for ${step.label}.` }
  }
  const chosen: CompositeChosen[] = []
  const finalPicks: CompositePick[] = []
  for (const step of steps) {
    let picked = picks.filter((pick) => keyOf(pick.component) === keyOf(step.label))
    if (picked.length === 0) {
      picked = step.options.filter((option) => option.isDefault).slice(0, step.max).map((option) => ({ component: step.label, productId: option.productId }))
    }
    if (picked.length < step.min) return { ok: false, error: step.min === 1 ? `Please choose an item for ${step.label}.` : `Please choose at least ${step.min} items for ${step.label}.` }
    if (picked.length > step.max) return { ok: false, error: step.max === 1 ? `Choose only one item for ${step.label}.` : `Choose at most ${step.max} items for ${step.label}.` }
    for (const pick of picked) {
      const option = step.options.find((o) => o.productId === pick.productId)
      if (!option) continue
      chosen.push({ step, option })
      finalPicks.push({ component: step.label, productId: pick.productId })
    }
  }
  return { ok: true, chosen, picks: finalPicks }
}

/** One line of text for an order line and the cart, like "Coffee: Ethiopia, Mug: Blue". */
export function compositeSummary(entries: Array<{ component: string; title: string }>): string {
  const byStep = new Map<string, string[]>()
  for (const entry of entries) byStep.set(entry.component, [...(byStep.get(entry.component) ?? []), entry.title])
  return [...byStep].map(([component, titles]) => `${component}: ${titles.join(', ')}`).join('; ')
}

/** Save-time checks for a composite product. Product lookups (is an item simple) happen on the server when priced. */
export function compositeErrors(data: Record<string, unknown>, selfId?: number | string): Array<{ path: string; message: string }> {
  if (data.productType !== 'composite') return []
  const errors: Array<{ path: string; message: string }> = []
  const options = Array.isArray(data.compositeOptions) ? (data.compositeOptions as CompositeOptionRow[]) : []
  const rules = Array.isArray(data.compositeRules) ? (data.compositeRules as CompositeRuleRow[]) : []
  const steps = compositeSteps(options, rules)
  if (steps.length === 0) errors.push({ path: 'compositeOptions', message: 'A composite product needs at least one item to choose from, each with a step name.' })
  if (steps.length > COMPOSITE_MAX_STEPS) errors.push({ path: 'compositeOptions', message: `A composite product can have at most ${COMPOSITE_MAX_STEPS} steps.` })
  if (options.length > COMPOSITE_MAX_OPTIONS) errors.push({ path: 'compositeOptions', message: `A composite product can offer at most ${COMPOSITE_MAX_OPTIONS} items.` })
  if (selfId != null && steps.some((step) => step.options.some((option) => String(option.productId) === String(selfId)))) errors.push({ path: 'compositeOptions', message: 'A composite product cannot offer itself.' })
  for (const row of options) {
    if (labelOf(row?.component) === '' && idOfRow(row?.product) !== null) {
      errors.push({ path: 'compositeOptions', message: 'Every item needs a step name.' })
      break
    }
  }
  for (const row of options) {
    const value = typeof row?.priceValue === 'number' ? row.priceValue : null
    if (value !== null && value < 0) {
      errors.push({ path: 'compositeOptions', message: 'An item price or discount cannot be negative.' })
      break
    }
    if (value !== null && row?.priceMode === 'discount' && value > 100) {
      errors.push({ path: 'compositeOptions', message: 'A discount is a percentage between 0 and 100.' })
      break
    }
  }
  for (const rule of rules) {
    const label = labelOf(rule?.component)
    if (label && !steps.some((step) => keyOf(step.label) === keyOf(label))) errors.push({ path: 'compositeRules', message: `The rule for "${label}" does not match any step in the item list.` })
    const min = wholeOrNull(rule?.minChoices)
    const max = wholeOrNull(rule?.maxChoices)
    if (min !== null && max !== null && max < min) errors.push({ path: 'compositeRules', message: `"${label}": the most cannot be below the fewest.` })
  }
  for (const step of steps) {
    const defaults = step.options.filter((option) => option.isDefault).length
    if (defaults > step.max) errors.push({ path: 'compositeOptions', message: `"${step.label}" has ${defaults} default items but takes at most ${step.max}.` })
    const asked = wholeOrNull((rules.find((r) => keyOf(labelOf(r?.component)) === keyOf(step.label)) as CompositeRuleRow | undefined)?.minChoices)
    if (step.required && asked !== null && asked > step.options.length) errors.push({ path: 'compositeRules', message: `"${step.label}" needs ${asked} items but only offers ${step.options.length}.` })
  }
  return errors
}
