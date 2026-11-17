/**
 * "Send as a request": a form's settings say that each entry also becomes a quote request, offer or item request, and
 * which form fields fill it. Pure: the server turns a submission into the same input the public request form posts, then
 * the quotes feature validates it as usual (so a form can never make a request the plain form could not).
 */

export const FEED_FIELDS = ['name', 'email', 'phone', 'quantity', 'details', 'deadline', 'offer'] as const
export type FeedField = (typeof FEED_FIELDS)[number]
export type FeedKind = 'quote' | 'bid' | 'item'

export type FormRequestFeed = {
  enabled: boolean
  kind: FeedKind
  /** A product the request is about, when no choice field is set. */
  productId: number | null
  /** A choice or dropdown field whose option values are product numbers. Overrides the fixed product. */
  productField: string
  /** Request detail to form field name. */
  map: Partial<Record<FeedField, string>>
}

export const NO_REQUEST_FEED: FormRequestFeed = { enabled: false, kind: 'quote', productId: null, productField: '', map: {} }

const fieldName = (v: unknown): string => (typeof v === 'string' && /^[A-Za-z0-9_.-]{1,60}$/.test(v.trim()) ? v.trim() : '')

export function normaliseRequestFeed(raw: unknown): FormRequestFeed {
  if (!raw || typeof raw !== 'object') return NO_REQUEST_FEED
  const r = raw as Record<string, unknown>
  const id = Number(r.productId)
  const map: Partial<Record<FeedField, string>> = {}
  const rawMap = r.map && typeof r.map === 'object' ? (r.map as Record<string, unknown>) : {}
  for (const key of FEED_FIELDS) {
    const name = fieldName(rawMap[key])
    if (name) map[key] = name
  }
  return {
    enabled: r.enabled === true,
    kind: r.kind === 'bid' || r.kind === 'item' ? r.kind : 'quote',
    productId: Number.isInteger(id) && id > 0 ? id : null,
    productField: fieldName(r.productField),
    map,
  }
}

const asText = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : Array.isArray(v) ? v.filter((x) => typeof x === 'string').join(', ') : '')

/** The body for the quotes parser, from one submission. `fallbackDetails` fills the details when no field is mapped to it. Null when the feed is off. */
export function buildRequestInput(feed: FormRequestFeed, values: Record<string, unknown>, fallbackDetails: string, pageUrl: string): Record<string, unknown> | null {
  if (!feed.enabled) return null
  const pick = (key: FeedField): string => (feed.map[key] ? asText(values[feed.map[key]!]) : '')
  const chosen = feed.productField ? Number(asText(values[feed.productField]).split(':')[0]) : NaN
  const productId = Number.isInteger(chosen) && chosen > 0 ? chosen : feed.productId
  return {
    kind: feed.kind,
    name: pick('name'),
    email: pick('email'),
    phone: pick('phone'),
    quantity: pick('quantity') || 1,
    details: pick('details') || fallbackDetails,
    deadline: pick('deadline'),
    offer: pick('offer'),
    productId: productId ?? undefined,
    pageUrl,
  }
}
