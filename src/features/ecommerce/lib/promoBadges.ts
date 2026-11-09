/**
 * Promo badges (Sale, New, Best seller ...) shown on product cards in the shop archive and elsewhere.
 *
 * Admins define the badges as the `promoBadges` array on the shop-extra-settings global; each badge has its
 * text, an icon from the built-in icon set, colours, a corner and an effect (all picked from lists), and a rule
 * saying which products it is on. This file is pure: it cleans the stored rows and decides which badges a product
 * gets. Nothing here reads the database.
 */

import { ICON_NAMES } from '@/components/blocks/elements/icons'

export const BADGE_POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const
export const BADGE_STYLES = ['solid', 'outline', 'soft'] as const
export const BADGE_SHAPES = ['rounded', 'pill', 'square'] as const
export const BADGE_EFFECTS = ['none', 'pulse', 'shine', 'bounce'] as const
export const BADGE_RULES = ['all', 'sale', 'new', 'soldOut', 'tag', 'category', 'products'] as const

export type BadgePosition = (typeof BADGE_POSITIONS)[number]
export type BadgeStyle = (typeof BADGE_STYLES)[number]
export type BadgeShape = (typeof BADGE_SHAPES)[number]
export type BadgeEffect = (typeof BADGE_EFFECTS)[number]
export type BadgeRule = (typeof BADGE_RULES)[number]

export type PromoBadge = {
  text: string
  icon: string | null
  colour: string
  textColour: string
  position: BadgePosition
  style: BadgeStyle
  shape: BadgeShape
  effect: BadgeEffect
  appliesTo: BadgeRule
  tag: string
  category: string
  productSlugs: string[]
  newDays: number
  priority: number
  startsAt: number | null
  endsAt: number | null
}

/** What the rules need to know about one product. */
export type BadgeProduct = {
  slug?: string | null
  category?: string | null
  tags?: unknown
  createdAt?: string | null
  onSale?: boolean
  soldOut?: boolean
}

export const DEFAULT_BADGE_COLOUR = '#b3261e'
export const DEFAULT_BADGE_TEXT_COLOUR = '#ffffff'
/** The most badges one card shows, so a long list of rules never buries the picture. */
export const MAX_BADGES_PER_CARD = 3

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

const pick = <T extends string>(list: readonly T[], value: unknown, fallback: T): T => (typeof value === 'string' && (list as readonly string[]).includes(value) ? (value as T) : fallback)

const time = (value: unknown): number | null => {
  if (typeof value !== 'string' || !value) return null
  const t = Date.parse(value)
  return Number.isFinite(t) ? t : null
}

const slugOf = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** Cleans the stored rows: unknown choices fall back to defaults, colours must be hex, empty or switched-off rows are dropped. */
export function normalisePromoBadges(raw: unknown): PromoBadge[] {
  if (!Array.isArray(raw)) return []
  const out: PromoBadge[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    if (r.enabled === false) continue
    const text = typeof r.text === 'string' ? r.text.trim().slice(0, 40) : ''
    const icon = typeof r.icon === 'string' && ICON_NAMES.includes(r.icon) ? r.icon : null
    if (!text && !icon) continue
    const newDays = Number(r.newDays)
    const priority = Number(r.priority)
    out.push({
      text,
      icon,
      colour: typeof r.colour === 'string' && HEX.test(r.colour.trim()) ? r.colour.trim() : DEFAULT_BADGE_COLOUR,
      textColour: typeof r.textColour === 'string' && HEX.test(r.textColour.trim()) ? r.textColour.trim() : DEFAULT_BADGE_TEXT_COLOUR,
      position: pick(BADGE_POSITIONS, r.position, 'top-left'),
      style: pick(BADGE_STYLES, r.style, 'solid'),
      shape: pick(BADGE_SHAPES, r.shape, 'rounded'),
      effect: pick(BADGE_EFFECTS, r.effect, 'none'),
      appliesTo: pick(BADGE_RULES, r.appliesTo, 'all'),
      tag: slugOf(r.tag),
      category: slugOf(r.category),
      productSlugs: String(r.productSlugs ?? '')
        .split(/[\s,]+/)
        .map(slugOf)
        .filter(Boolean),
      newDays: Number.isFinite(newDays) && newDays >= 1 ? Math.min(Math.floor(newDays), 365) : 30,
      priority: Number.isFinite(priority) ? priority : 10,
      startsAt: time(r.startsAt),
      endsAt: time(r.endsAt),
    })
  }
  return out
}

/** The tag slugs and names of a product (depth 1 gives objects; ids and strings are ignored). */
const tagSlugs = (tags: unknown): string[] => {
  if (!Array.isArray(tags)) return []
  const slugs: string[] = []
  for (const tag of tags) {
    if (tag && typeof tag === 'object') {
      const t = tag as { slug?: unknown; name?: unknown }
      if (typeof t.slug === 'string') slugs.push(slugOf(t.slug))
      else if (typeof t.name === 'string') slugs.push(slugOf(t.name))
    }
  }
  return slugs
}

const live = (badge: PromoBadge, now: number): boolean => (badge.startsAt === null || badge.startsAt <= now) && (badge.endsAt === null || badge.endsAt >= now)

/** Does this badge's rule match the product? */
export function badgeMatches(badge: PromoBadge, product: BadgeProduct, now: Date = new Date()): boolean {
  if (!live(badge, now.getTime())) return false
  switch (badge.appliesTo) {
    case 'all':
      return true
    case 'sale':
      return product.onSale === true
    case 'soldOut':
      return product.soldOut === true
    case 'new': {
      const created = time(product.createdAt)
      return created !== null && now.getTime() - created <= badge.newDays * 86_400_000 && created <= now.getTime()
    }
    case 'tag':
      return badge.tag !== '' && tagSlugs(product.tags).includes(badge.tag)
    case 'category':
      return badge.category !== '' && slugOf(product.category) === badge.category
    case 'products':
      return Boolean(product.slug) && badge.productSlugs.includes(slugOf(product.slug))
    default:
      return false
  }
}

/** The badges a product gets: lower priority numbers first, at most MAX_BADGES_PER_CARD. */
export function badgesFor(badges: PromoBadge[], product: BadgeProduct, now: Date = new Date()): PromoBadge[] {
  return badges
    .map((badge, index) => ({ badge, index }))
    .filter(({ badge }) => badgeMatches(badge, product, now))
    .sort((a, b) => a.badge.priority - b.badge.priority || a.index - b.index)
    .slice(0, MAX_BADGES_PER_CARD)
    .map(({ badge }) => badge)
}

/** Reads the switch and the rows from the shop-extra-settings document. A missing value means on, with no badges. */
export function promoBadgesFrom(doc: unknown): PromoBadge[] {
  const d = (doc ?? {}) as { promoBadgesEnabled?: unknown; promoBadges?: unknown }
  return d.promoBadgesEnabled === false ? [] : normalisePromoBadges(d.promoBadges)
}

type Engine = { findGlobal(a: unknown): Promise<unknown> }

/** One read of the badges for a request (server only). Never throws; a failure means no badges. */
export async function loadPromoBadges(engine: Engine): Promise<PromoBadge[]> {
  try {
    return promoBadgesFrom(await engine.findGlobal({ slug: 'shop-extra-settings', depth: 0, overrideAccess: true }))
  } catch {
    return []
  }
}
