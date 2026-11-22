import { isoDate, parseJson, safeHttpUrl, str, truncate } from '@/features/socialFeeds/parse'

import { SOURCE_LABEL, type LiveReview, type ReviewAccount, type ReviewProvider } from './types'

/**
 * One adapter per review provider: the request, the hosts it may reach, and the parser. Reviews are fetched on the
 * server only, cached, and shown with the provider's name as a badge and a link back to the review where one exists.
 */

const enc = encodeURIComponent
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [])
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const stars = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(str(v))
  return Number.isFinite(n) && n >= 1 ? Math.min(5, Math.round(n)) : null
}
const TEXT_MAX = 600

type Request = { url: string; headers: Record<string, string> }
type Adapter = { host: string; build: (id: string, a: ReviewAccount) => Request; parse: (body: string, source: string) => LiveReview[] }

/** Place, page and business IDs are plain tokens. Anything else is refused before it can reach a URL. */
export const validPlaceId = (v: string): string => (/^[A-Za-z0-9_.:-]{3,200}$/.test(v.trim()) ? v.trim() : '')

const google: Adapter = {
  host: 'places.googleapis.com',
  build: (id, a) => ({
    url: `https://places.googleapis.com/v1/places/${enc(id)}`,
    headers: { 'X-Goog-Api-Key': a.token, 'X-Goog-FieldMask': 'reviews' },
  }),
  parse: (body, source) =>
    arr(parseJson(body).reviews).map((r): LiveReview => ({
      name: str(obj(r.authorAttribution).displayName),
      rating: stars(r.rating),
      text: truncate(str(obj(r.text).text) || str(obj(r.originalText).text), TEXT_MAX),
      date: isoDate(r.publishTime),
      url: safeHttpUrl(obj(r.authorAttribution).uri) || safeHttpUrl(r.googleMapsUri),
      source,
    })),
}

const facebook: Adapter = {
  host: 'graph.facebook.com',
  build: (id, a) => ({
    url: `https://graph.facebook.com/v19.0/${enc(id)}/ratings?fields=reviewer{name},rating,recommendation_type,review_text,created_time&limit=25&access_token=${enc(a.token)}`,
    headers: {},
  }),
  parse: (body, source) =>
    arr(parseJson(body).data).map((r): LiveReview => {
      // Pages that use Recommends / Does not recommend have no stars: map them to 5 and 2 stars.
      const rec = str(r.recommendation_type)
      return {
        name: str(obj(r.reviewer).name),
        rating: stars(r.rating) ?? (rec === 'positive' ? 5 : rec === 'negative' ? 2 : null),
        text: truncate(str(r.review_text), TEXT_MAX),
        date: isoDate(r.created_time),
        url: '',
        source,
      }
    }),
}

const yelp: Adapter = {
  host: 'api.yelp.com',
  build: (id, a) => ({
    url: `https://api.yelp.com/v3/businesses/${enc(id)}/reviews?limit=3&sort_by=newest`,
    headers: { Authorization: `Bearer ${a.token}` },
  }),
  parse: (body, source) =>
    arr(parseJson(body).reviews).map((r): LiveReview => ({
      name: str(obj(r.user).name),
      rating: stars(r.rating),
      text: truncate(str(r.text), TEXT_MAX),
      date: isoDate(r.time_created),
      url: safeHttpUrl(r.url),
      source,
    })),
}

export const REVIEW_ADAPTERS: Record<ReviewProvider, Adapter> = { 'google-reviews': google, 'facebook-reviews': facebook, 'yelp-reviews': yelp }

const TIMEOUT_MS = 6000
const MAX_BYTES = 1_500_000

/** Removes the key (and its URL-encoded form) from any text that might reach a log or a response. */
export const redactKey = (text: string, token: string): string => (token ? text.split(token).join('***').split(enc(token)).join('***') : text)

export type FetchLike = (url: string, init: Record<string, unknown>) => Promise<Response>

/**
 * Fetches and parses reviews for one place. Throws an Error whose message never holds the key or the URL. The
 * request only goes to the provider's own host.
 */
export async function fetchReviews(account: ReviewAccount, placeId: string, fetchImpl: FetchLike = fetch as never): Promise<LiveReview[]> {
  const adapter = REVIEW_ADAPTERS[account.provider]
  if (!adapter) throw new Error('Unsupported provider')
  if (!account.token) throw new Error('No key saved for this source')
  const id = validPlaceId(placeId || account.accountId)
  if (!id) throw new Error('Add a valid place, page or business ID')
  const req = adapter.build(id, account)
  const host = new URL(req.url).hostname
  if (host !== adapter.host) throw new Error('Host is not allowed')
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  try {
    const res = await fetchImpl(req.url, { method: 'GET', signal: ctl.signal, redirect: 'error', headers: { Accept: 'application/json', 'User-Agent': 'SiteReviews/1.0', ...req.headers } })
    if (!res.ok) throw new Error(`The provider answered with status ${res.status}`)
    const body = (await res.text()).slice(0, MAX_BYTES)
    return adapter.parse(body, SOURCE_LABEL[account.provider]).filter((r) => r.text || r.rating !== null).slice(0, 25)
  } catch (error) {
    const raw = error instanceof Error ? error.message : 'Request failed'
    throw new Error((ctl.signal.aborted ? 'The provider took too long to answer' : redactKey(raw, account.token)).slice(0, 200))
  } finally {
    clearTimeout(timer)
  }
}
