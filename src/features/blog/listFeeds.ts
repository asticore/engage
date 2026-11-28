import { buildRss, type FeedPost } from './rss'
import { shopPath } from '@/features/seo/permalinks'

/** Task 6 (16f): RSS feeds for events (`/feed/events.xml`) and products (`/feed/products.xml`). Pure: rows in, XML out. */
type Media = { url?: unknown; mimeType?: unknown } | number | null | undefined
const image = (value: Media, baseUrl: string): FeedPost['image'] => {
  const m = value && typeof value === 'object' ? value : null
  if (!m || typeof m.url !== 'string' || !m.url) return undefined
  const url = /^https?:\/\//i.test(m.url) ? m.url : `${baseUrl}${m.url.startsWith('/') ? '' : '/'}${m.url}`
  return { url, mime: typeof m.mimeType === 'string' ? m.mimeType : undefined }
}

export type EventRow = { title?: string | null; slug?: string | null; startDate?: string | null; summary?: string | null; coverImage?: Media }
export type ProductRow = { title?: string | null; slug?: string | null; createdAt?: string | null; shortDescription?: string | null; images?: Media[] | null }

export function eventFeed(input: { rows: EventRow[]; baseUrl: string; selfUrl: string; siteName: string }): string {
  const posts: FeedPost[] = input.rows
    .filter((r) => r.slug && r.title)
    .map((r) => ({ path: `/events/${encodeURIComponent(r.slug as string)}`, title: r.title as string, slug: r.slug as string, date: r.startDate ?? '', excerpt: (r.summary ?? '').trim(), html: '', author: '', categories: [], image: image(r.coverImage, input.baseUrl) }))
  const title = `Events${input.siteName ? ` | ${input.siteName}` : ''}`
  return buildRss({ title, link: `${input.baseUrl}/events`, selfUrl: input.selfUrl, description: title, baseUrl: input.baseUrl, mode: 'summary', posts })
}

export function productFeed(input: { rows: ProductRow[]; baseUrl: string; selfUrl: string; siteName: string; shopBase: string }): string {
  const posts: FeedPost[] = input.rows
    .filter((r) => r.slug && r.title)
    .map((r) => ({ path: shopPath(input.shopBase, `/${encodeURIComponent(r.slug as string)}`), title: r.title as string, slug: r.slug as string, date: r.createdAt ?? '', excerpt: (r.shortDescription ?? '').trim(), html: '', author: '', categories: [], image: image(r.images?.[0], input.baseUrl) }))
  const title = `New products${input.siteName ? ` | ${input.siteName}` : ''}`
  return buildRss({ title, link: `${input.baseUrl}${shopPath(input.shopBase, '')}`, selfUrl: input.selfUrl, description: title, baseUrl: input.baseUrl, mode: 'summary', posts })
}
