/**
 * Wholesale mode (Task 11d). Pure, no I/O: the shop switches, who counts as a wholesale buyer, when prices are hidden,
 * which products a buyer may see or buy, the minimum order value and the minimum quantity shown from a wholesale tier.
 *
 * A wholesale buyer is a signed-in account that has an approved wholesale application. That puts the configured role
 * name (default "wholesale") in the buyer's customer types, so price tiers and pricing rules for that role apply.
 * Admins are never held back by any of these checks.
 */

import { applicableTiers, type PriceTier } from './priceTiers'

export type HideFrom = 'guests' | 'non-wholesale'

export type WholesaleConfig = {
  enabled: boolean
  /** The customer type an approved buyer gets, lower case. */
  role: string
  hidePrices: boolean
  hideFrom: HideFrom
  /** The owner's own wording for a hidden price. Blank means use the translated store text. */
  hiddenText: string
  /** Smallest cart subtotal a wholesale buyer can check out with, in cents. Null means no minimum. */
  minOrderCents: number | null
  /** Whether the public wholesale application is open. */
  applyOpen: boolean
}

export const DEFAULT_WHOLESALE_ROLE = 'wholesale'
export const DEFAULT_HIDDEN_PRICE_TEXT = 'Sign in to see prices'

export const WHOLESALE_OFF: WholesaleConfig = {
  enabled: false,
  role: DEFAULT_WHOLESALE_ROLE,
  hidePrices: false,
  hideFrom: 'guests',
  hiddenText: '',
  minOrderCents: null,
  applyOpen: false,
}

/** Reads the shop switches global. A missing row or value means wholesale is off. Never throws. */
export function normaliseWholesaleConfig(doc: unknown): WholesaleConfig {
  const d = (doc && typeof doc === 'object' ? doc : {}) as Record<string, unknown>
  const role = typeof d.wholesaleRole === 'string' && d.wholesaleRole.trim() ? d.wholesaleRole.trim().toLowerCase().slice(0, 60) : DEFAULT_WHOLESALE_ROLE
  const minDollars = Number(d.wholesaleMinOrder)
  const text = typeof d.wholesaleHiddenPriceText === 'string' ? d.wholesaleHiddenPriceText.trim().slice(0, 120) : ''
  return {
    enabled: d.wholesaleEnabled === true,
    role,
    hidePrices: d.wholesaleHidePrices === true,
    hideFrom: d.wholesaleHideFrom === 'non-wholesale' ? 'non-wholesale' : 'guests',
    hiddenText: text,
    minOrderCents: Number.isFinite(minDollars) && minDollars > 0 ? Math.round(minDollars * 100) : null,
    applyOpen: d.wholesaleApplyOpen === true,
  }
}

/** Who is looking: whether they are signed in and their customer types (roles, companies, tags, wholesale role). */
export type Buyer = { signedIn: boolean; types: string[] }

const has = (types: string[], name: string): boolean => types.some((t) => t.trim().toLowerCase() === name.toLowerCase())

export const isAdminBuyer = (buyer: Buyer): boolean => buyer.signedIn && has(buyer.types, 'admin')

export const isWholesaleBuyer = (cfg: WholesaleConfig, buyer: Buyer): boolean => cfg.enabled && buyer.signedIn && has(buyer.types, cfg.role)

/** True when this visitor must not be shown prices. */
export function pricesHiddenFor(cfg: WholesaleConfig, buyer: Buyer): boolean {
  if (!cfg.enabled || !cfg.hidePrices || isAdminBuyer(buyer)) return false
  if (cfg.hideFrom === 'guests') return !buyer.signedIn
  return !isWholesaleBuyer(cfg, buyer)
}

/** A wholesale-only product is visible to wholesale buyers and admins. With wholesale mode off the flag is ignored. */
export function productAllowedFor(cfg: WholesaleConfig, wholesaleOnly: unknown, buyer: Buyer): boolean {
  if (!cfg.enabled || wholesaleOnly !== true) return true
  return isAdminBuyer(buyer) || isWholesaleBuyer(cfg, buyer)
}

/** Keeps the products this buyer may see. Pure. */
export function filterWholesaleVisible<T extends { wholesaleOnly?: unknown }>(cfg: WholesaleConfig, docs: T[], buyer: Buyer): T[] {
  return cfg.enabled ? docs.filter((doc) => productAllowedFor(cfg, doc.wholesaleOnly, buyer)) : docs
}

/** How far a wholesale buyer's cart is under the minimum, in cents (0 when fine, not a wholesale buyer or no minimum). */
export function minOrderShortfallCents(cfg: WholesaleConfig, buyer: Buyer, subtotalCents: number): number {
  if (!isWholesaleBuyer(cfg, buyer) || isAdminBuyer(buyer) || cfg.minOrderCents === null) return 0
  return Math.max(0, cfg.minOrderCents - Math.max(0, subtotalCents))
}

/**
 * The wholesale minimum quantity for a product, from the buyer's own tiers: the lowest quantity at which a tier for
 * this buyer's customer types starts, when that is above 1 (tiers for everyone are not counted). Null when none.
 */
export function wholesaleMoq(tiers: PriceTier[], productId: string, variationId: string | null, buyer: Buyer): number | null {
  const own = applicableTiers(tiers, productId, variationId, buyer.types).filter((t) => t.customerType !== null)
  if (own.length === 0) return null
  const lowest = Math.min(...own.map((t) => t.minQty))
  return lowest > 1 ? lowest : null
}

export type ApplicationStatus = 'pending' | 'approved' | 'rejected'

export const APPLICATION_STATUSES: ApplicationStatus[] = ['pending', 'approved', 'rejected']

export type ApplicationInput = { company: string; taxId: string; phone: string; message: string }

/** Cleans the public application form. `error` is set when something needed is missing. */
export function validateApplication(raw: unknown): { value: ApplicationInput; error: string | null } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
  const value: ApplicationInput = { company: text(r.company, 120), taxId: text(r.taxId, 40), phone: text(r.phone, 40), message: typeof r.message === 'string' ? r.message.trim().slice(0, 1000) : '' }
  if (!value.company) return { value, error: 'Enter your company name.' }
  return { value, error: null }
}

/** Customer tags: lower case, trimmed, no commas, at most 40 characters, at most 30 per customer. */
export function normaliseTags(input: unknown): string[] {
  const list = Array.isArray(input) ? input : typeof input === 'string' ? input.split(',') : []
  const out: string[] = []
  for (const raw of list) {
    const tag = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/^tag:/, '').replace(/\s+/g, '-').slice(0, 40) : ''
    if (tag && !out.includes(tag)) out.push(tag)
    if (out.length >= 30) break
  }
  return out
}

/** The customer-type entry for a tag, the form pricing rules and tiers match on. */
export const tagType = (tag: string): string => `tag:${tag}`
