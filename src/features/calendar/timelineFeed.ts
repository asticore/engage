import { getEngine } from '@/lib/engine'
import { excludeProtected } from '@/features/visibility/excludeProtected'

/**
 * Items for the "Timeline from events or posts" element (Task 15, 34a2). Reads published, unprotected documents and
 * returns timeline item rows. Never throws: a failed read gives an empty list.
 */

export type FeedSource = 'events' | 'past-events' | 'posts'
export const FEED_SOURCES: readonly FeedSource[] = ['events', 'past-events', 'posts']
export type FeedItem = { date: string; group: string; title: string; text: string; icon: string; image: string; alt: string; url: string; linkLabel: string; color: string }

type Doc = { title?: string; slug?: string; summary?: string; excerpt?: string; startDate?: string; publishedDate?: string; trashedAt?: string | null }

export const isoDay = (v: string | undefined): string => (v && !Number.isNaN(new Date(v).getTime()) ? new Date(v).toISOString().slice(0, 10) : '')

/** Pure mapping, unit tested. Documents without a title, slug or date are skipped. */
export function toFeedItems(source: FeedSource, docs: Doc[], linkLabel: string): FeedItem[] {
  const out: FeedItem[] = []
  for (const d of docs) {
    const date = isoDay(source === 'posts' ? d.publishedDate : d.startDate)
    if (!d.title || !d.slug || !date || d.trashedAt) continue
    out.push({
      date, group: date.slice(0, 4), title: d.title, text: ((source === 'posts' ? d.excerpt : d.summary) ?? '').trim(),
      icon: '', image: '', alt: '', url: source === 'posts' ? `/blog/${d.slug}` : `/events/${d.slug}`, linkLabel, color: '',
    })
  }
  return out
}

export async function loadFeedItems(source: FeedSource, count: number, linkLabel: string): Promise<FeedItem[]> {
  try {
    const engine = await getEngine()
    const nowIso = new Date().toISOString()
    const collection = source === 'posts' ? 'posts' : 'events'
    const field = source === 'posts' ? 'publishedDate' : 'startDate'
    const where = source === 'events'
      ? { and: [{ _status: { equals: 'published' } }, { startDate: { greater_than_equal: nowIso } }] }
      : source === 'past-events'
        ? { and: [{ _status: { equals: 'published' } }, { startDate: { less_than: nowIso } }] }
        : { and: [{ _status: { equals: 'published' } }, { publishedDate: { less_than_equal: nowIso } }] }
    const { docs } = (await engine.find({ collection, where, sort: source === 'events' ? field : `-${field}`, limit: count, depth: 0 } as never)) as unknown as { docs: Doc[] }
    const visible = (await excludeProtected(collection as never, docs as never)) as unknown as Doc[]
    return toFeedItems(source, visible, linkLabel)
  } catch {
    return []
  }
}
