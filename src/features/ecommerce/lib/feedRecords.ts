/**
 * Product feeds as records: each feed has a channel, a secret address, a currency, an optional price tier and
 * product filters. Pure: no I/O, so the admin preview and the public feed share one set of rules.
 */

import { csvCell } from './manifest'
import { META_COLUMNS, metaCatalogCsv, googleMerchantXml, type FeedItem } from './feeds'

export const FEED_CHANNELS = ['google', 'meta', 'pinterest', 'csv', 'xml'] as const
export type FeedChannel = (typeof FEED_CHANNELS)[number]

export const FEED_CHANNEL_LABELS: Record<FeedChannel, string> = {
  google: 'Google Merchant (XML)',
  meta: 'Meta / Facebook catalogue (CSV)',
  pinterest: 'Pinterest catalogue (CSV)',
  csv: 'Generic CSV',
  xml: 'Generic XML',
}

export const isFeedChannel = (value: unknown): value is FeedChannel => typeof value === 'string' && (FEED_CHANNELS as readonly string[]).includes(value)

export type FeedRecord = {
  id: number
  name: string
  channel: FeedChannel
  /** The secret part of the feed address. */
  token: string
  /** ISO currency of the prices. Blank means the shop currency. */
  currency: string
  /** Customer type (role or company) whose tier price is used. Blank means the normal price. */
  priceTier: string
  /** Only products in this category (slug). Blank means all. */
  category: string
  /** Only products with this tag (slug). Blank means all. */
  tag: string
  includeOutOfStock: boolean
  enabled: boolean
}

const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '')

export type FeedInput = Omit<FeedRecord, 'id' | 'token'>

export function parseFeedInput(raw: unknown): { ok: true; feed: FeedInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Send the feed details.' }
  const r = raw as Record<string, unknown>
  const name = text(r.name, 100)
  if (!name) return { ok: false, error: 'Give the feed a name.' }
  if (!isFeedChannel(r.channel)) return { ok: false, error: 'Pick a channel from the list.' }
  const currency = text(r.currency, 10).toUpperCase()
  if (currency && !/^[A-Z]{3}$/.test(currency)) return { ok: false, error: 'The currency must be a three letter code, for example AUD.' }
  return {
    ok: true,
    feed: {
      name,
      channel: r.channel,
      currency,
      priceTier: text(r.priceTier, 80),
      category: text(r.category, 80).toLowerCase(),
      tag: text(r.tag, 80).toLowerCase(),
      includeOutOfStock: r.includeOutOfStock === true,
      enabled: r.enabled !== false,
    },
  }
}

/** The feed address path for a record. */
export const feedPath = (feed: Pick<FeedRecord, 'token' | 'channel'>): string => `/feeds/custom/${feed.token}${feed.channel === 'google' || feed.channel === 'xml' ? '.xml' : '.csv'}`

/** The token from the last part of a feed address (`abc123.xml` gives `abc123`), or null when it is malformed. */
export function tokenFromSegment(segment: string): string | null {
  const match = /^([a-f0-9]{32})\.(xml|csv)$/.exec(segment)
  return match ? match[1] : null
}

export const PINTEREST_COLUMNS = ['id', 'title', 'description', 'link', 'image_link', 'price', 'availability', 'condition', 'brand', 'google_product_category', 'sale_price', 'item_group_id', 'gtin', 'mpn', 'color', 'size', 'product_type', 'additional_image_link']

export function pinterestCsv(items: FeedItem[]): string {
  const lines = [PINTEREST_COLUMNS.join(',')]
  for (const i of items) {
    // Pinterest takes "in stock", "out of stock" and "preorder".
    const availability = i.availability === 'backorder' ? 'preorder' : i.availability
    lines.push(
      [i.id, i.title.slice(0, 500), i.description.slice(0, 10000), i.link, i.imageLink, i.price, availability, i.condition, i.brand, i.googleCategory, i.salePrice, i.groupId, i.gtin, i.mpn, i.color, i.size, i.productType, i.additionalImages.join(',')]
        .map(csvCell)
        .join(','),
    )
  }
  return lines.join('\r\n') + '\r\n'
}

export function genericCsv(items: FeedItem[]): string {
  return metaCatalogCsv(items)
}

/** The feed body and content type for a channel. */
export function renderFeed(channel: FeedChannel, items: FeedItem[], site: { title: string; link: string }): { body: string; contentType: string } {
  switch (channel) {
    case 'google':
    case 'xml':
      return { body: googleMerchantXml(items, { title: site.title, link: site.link, description: site.title }), contentType: 'application/xml; charset=utf-8' }
    case 'pinterest':
      return { body: pinterestCsv(items), contentType: 'text/csv; charset=utf-8' }
    case 'meta':
    case 'csv':
      return { body: genericCsv(items), contentType: 'text/csv; charset=utf-8' }
  }
}

export type FeedProblem = { id: string; message: string }

const REQUIRED: Record<FeedChannel, (keyof FeedItem)[]> = {
  google: ['id', 'title', 'description', 'link', 'imageLink', 'price', 'availability'],
  meta: ['id', 'title', 'description', 'link', 'imageLink', 'price', 'availability', 'brand'],
  pinterest: ['id', 'title', 'description', 'link', 'imageLink', 'price', 'availability'],
  csv: ['id', 'title', 'link', 'imageLink', 'price'],
  xml: ['id', 'title', 'link', 'imageLink', 'price'],
}

const FIELD_LABEL: Partial<Record<keyof FeedItem, string>> = { imageLink: 'image', id: 'id', title: 'title', description: 'description', link: 'link', price: 'price', availability: 'availability', brand: 'brand' }

/** What the channel would reject: missing required columns, duplicate ids and over-long text. */
export function validateFeed(channel: FeedChannel, items: FeedItem[]): FeedProblem[] {
  const problems: FeedProblem[] = []
  const seen = new Set<string>()
  for (const item of items) {
    for (const key of REQUIRED[channel]) {
      if (!String(item[key] ?? '').trim()) problems.push({ id: item.id, message: `Missing ${FIELD_LABEL[key] ?? key}.` })
    }
    if (seen.has(item.id)) problems.push({ id: item.id, message: 'The id is used by more than one row.' })
    seen.add(item.id)
    if (channel === 'google' && item.title.length > 150) problems.push({ id: item.id, message: 'The title is over 150 characters.' })
    if (channel === 'pinterest' && item.title.length > 500) problems.push({ id: item.id, message: 'The title is over 500 characters.' })
  }
  return problems.slice(0, 200)
}

const slugOf = (v: unknown): string => (v && typeof v === 'object' ? String((v as Record<string, unknown>).slug ?? '') : typeof v === 'string' ? v : '').toLowerCase()

/** Whether a product passes a feed record's category and tag filters. Slugs are compared in lower case. */
export function matchesFeedFilters(product: Record<string, unknown>, filters: { category: string; tag: string }): boolean {
  if (filters.category && slugOf(product.category) !== filters.category) return false
  if (filters.tag && !(Array.isArray(product.tags) ? product.tags : []).some((t) => slugOf(t) === filters.tag)) return false
  return true
}


export { META_COLUMNS }
