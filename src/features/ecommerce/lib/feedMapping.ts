import type { FeedItem } from './feeds'

/** Feed columns an admin can fill from a template instead of the built-in value. */
export const FEED_MAP_FIELDS = ['title', 'description', 'brand', 'gtin', 'mpn', 'condition', 'googleCategory', 'productType', 'color', 'size'] as const
export type FeedMapField = (typeof FEED_MAP_FIELDS)[number]
export type FeedMapping = Partial<Record<FeedMapField, string>>

export const FEED_MAP_LABELS: Record<FeedMapField, string> = {
  title: 'Title',
  description: 'Description',
  brand: 'Brand',
  gtin: 'GTIN / barcode',
  mpn: 'MPN',
  condition: 'Condition (new, used or refurbished)',
  googleCategory: 'Google product category',
  productType: 'Product type',
  color: 'Colour',
  size: 'Size',
}

export const REFRESH_CHOICES = [15, 30, 60, 360, 1440] as const
export const DEFAULT_REFRESH_MINUTES = 60

const MAX_TEMPLATE = 300
const CONDITIONS = ['new', 'used', 'refurbished']

/** Keeps only known columns with a non-empty template, trimmed and length limited. */
export function parseMapping(raw: unknown): FeedMapping {
  const source = typeof raw === 'string' ? safeJson(raw) : raw
  const out: FeedMapping = {}
  if (!source || typeof source !== 'object') return out
  for (const field of FEED_MAP_FIELDS) {
    const v = (source as Record<string, unknown>)[field]
    if (typeof v === 'string' && v.trim()) out[field] = v.trim().slice(0, MAX_TEMPLATE)
  }
  return out
}

const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export const parseRefreshMinutes = (raw: unknown): number => {
  const n = Number(raw)
  return (REFRESH_CHOICES as readonly number[]).includes(n) ? n : DEFAULT_REFRESH_MINUTES
}

const lookup = (doc: Record<string, unknown>, path: string): string => {
  let cur: unknown = doc
  for (const part of path.split('.')) {
    if (!cur || typeof cur !== 'object' || /^(__proto__|constructor|prototype)$/.test(part)) return ''
    cur = (cur as Record<string, unknown>)[part]
  }
  if (typeof cur === 'string') return cur
  if (typeof cur === 'number' || typeof cur === 'boolean') return String(cur)
  if (cur && typeof cur === 'object' && typeof (cur as Record<string, unknown>).title === 'string') return String((cur as Record<string, unknown>).title)
  return ''
}

/** Text with `{field}` placeholders filled from the product, for example `{brand} {title}`. Text without braces is used as written. */
export function renderTemplate(template: string, product: Record<string, unknown>): string {
  return template.replace(/\{([A-Za-z0-9_.]{1,60})\}/g, (_, path: string) => lookup(product, path)).replace(/\s+/g, ' ').trim()
}

/** The overrides one mapping gives a row. A blank result keeps the built-in value; a bad condition is ignored. */
export function mappedFields(product: Record<string, unknown>, mapping: FeedMapping): Partial<FeedItem> {
  const out: Record<string, string> = {}
  for (const field of FEED_MAP_FIELDS) {
    const template = mapping[field]
    if (!template) continue
    const value = renderTemplate(template, product)
    if (!value) continue
    if (field === 'condition' && !CONDITIONS.includes(value.toLowerCase())) continue
    out[field] = field === 'condition' ? value.toLowerCase() : field === 'title' ? value.slice(0, 150) : value
  }
  return out as Partial<FeedItem>
}
