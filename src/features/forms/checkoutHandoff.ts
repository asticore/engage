/**
 * "Go to checkout" at the end of a form: the form's settings say which product goes in the cart (fixed, or chosen by a
 * form field) and which form fields fill the checkout details. Pure: the server builds the address from a submission
 * and the checkout page reads it back. The handoff only names a product and details to fill in; prices, stock and
 * everything else are decided by the cart and the checkout as usual.
 */

export const CUSTOMER_FIELDS = ['email', 'name', 'phone', 'line1', 'city', 'state', 'postcode', 'country', 'note'] as const
export type CustomerField = (typeof CUSTOMER_FIELDS)[number]

export type FormCheckoutConfig = {
  enabled: boolean
  /** The product to add when no choice field is set. */
  productId: number | null
  variationId: string
  quantity: number
  /** A select or radio field whose option values are product ids ("12") or product and variation ("12:abc"). Overrides the fixed product. */
  choiceField: string
  /** Checkout detail to form field name. */
  map: Partial<Record<CustomerField, string>>
}

export const NO_CHECKOUT: FormCheckoutConfig = { enabled: false, productId: null, variationId: '', quantity: 1, choiceField: '', map: {} }

const fieldName = (v: unknown): string => (typeof v === 'string' && /^[A-Za-z0-9_.-]{1,60}$/.test(v.trim()) ? v.trim() : '')

export function normaliseCheckoutConfig(raw: unknown): FormCheckoutConfig {
  if (!raw || typeof raw !== 'object') return NO_CHECKOUT
  const r = raw as Record<string, unknown>
  const id = Number(r.productId)
  const qty = Math.floor(Number(r.quantity))
  const map: Partial<Record<CustomerField, string>> = {}
  const rawMap = r.map && typeof r.map === 'object' ? (r.map as Record<string, unknown>) : {}
  for (const key of CUSTOMER_FIELDS) {
    const name = fieldName(rawMap[key])
    if (name) map[key] = name
  }
  return {
    enabled: r.enabled === true,
    productId: Number.isInteger(id) && id > 0 ? id : null,
    variationId: typeof r.variationId === 'string' ? r.variationId.trim().slice(0, 80) : '',
    quantity: Number.isInteger(qty) && qty >= 1 && qty <= 999 ? qty : 1,
    choiceField: fieldName(r.choiceField),
    map,
  }
}

export type Handoff = {
  product: number
  variation: string | null
  quantity: number
  /** The form entry this came from, so the checkout can mention it. */
  entry: number | null
  customer: Partial<Record<CustomerField, string>>
}

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim().slice(0, 500) : typeof v === 'number' ? String(v) : '')

/** The handoff for one submission, or null when the settings do not name a product that this submission selects. */
export function buildHandoff(config: FormCheckoutConfig, values: Record<string, unknown>, entryId?: number | string | null): Handoff | null {
  if (!config.enabled) return null
  let product = config.productId
  let variation = config.variationId || null
  if (config.choiceField) {
    const chosen = clean(values[config.choiceField])
    const [p, v] = chosen.split(':')
    const id = Number(p)
    if (!Number.isInteger(id) || id <= 0) return null
    product = id
    variation = v ? v.slice(0, 80) : null
  }
  if (!product) return null
  const customer: Partial<Record<CustomerField, string>> = {}
  for (const key of CUSTOMER_FIELDS) {
    const name = config.map[key]
    const value = name ? clean(values[name]) : ''
    if (value) customer[key] = value
  }
  const entry = Number(entryId)
  return { product, variation, quantity: config.quantity, entry: Number.isInteger(entry) && entry > 0 ? entry : null, customer }
}

/** URL-safe text for the checkout address. Works in the browser and on the server. */
export function encodeHandoff(handoff: Handoff): string {
  const bytes = new TextEncoder().encode(JSON.stringify(handoff))
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Reads it back with the same limits as buildHandoff. Anything malformed gives null. */
export function decodeHandoff(token: string): Handoff | null {
  try {
    if (!/^[A-Za-z0-9_-]{1,4000}$/.test(token)) return null
    const binary = atob(token.replace(/-/g, '+').replace(/_/g, '/'))
    const parsed = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))) as Record<string, unknown>
    const product = Number(parsed.product)
    const quantity = Math.floor(Number(parsed.quantity))
    if (!Number.isInteger(product) || product <= 0 || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) return null
    const customer: Partial<Record<CustomerField, string>> = {}
    const rawCustomer = parsed.customer && typeof parsed.customer === 'object' ? (parsed.customer as Record<string, unknown>) : {}
    for (const key of CUSTOMER_FIELDS) {
      const value = clean(rawCustomer[key])
      if (value) customer[key] = value
    }
    const entry = Number(parsed.entry)
    return {
      product,
      variation: typeof parsed.variation === 'string' && parsed.variation ? parsed.variation.slice(0, 80) : null,
      quantity,
      entry: Number.isInteger(entry) && entry > 0 ? entry : null,
      customer,
    }
  } catch {
    return null
  }
}

export const checkoutHandoffUrl = (handoff: Handoff): string => `/checkout?handoff=${encodeHandoff(handoff)}`
