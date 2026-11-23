import { excludeProtected } from '@/features/visibility/excludeProtected'
import { getEngine } from '@/lib/engine'

import { categorise, extractTags, type CalEvent, type CategoryRule } from './model'

type Doc = {
  id: number | string
  slug?: string | null
  title?: string | null
  summary?: string | null
  startDate?: string | null
  endDate?: string | null
  eventType?: string | null
  coverImage?: { url?: string | null } | number | null
  location?: { venueName?: string | null; address?: string | null; isOnline?: boolean | null } | null
  trashedAt?: string | null
}

export const CALENDAR_MAX_EVENTS = 300

/** Published, unprotected events between `from` and `to` as plain calendar events. Never throws. */
export async function loadCalendarEvents(opts: { from: string; to: string; rules: CategoryRule[]; fallback: { category: string; color: string } }): Promise<CalEvent[]> {
  try {
    const engine = await getEngine()
    const { docs } = (await engine.find({
      collection: 'events',
      where: { and: [{ _status: { equals: 'published' } }, { startDate: { greater_than_equal: opts.from } }, { startDate: { less_than: opts.to } }] },
      sort: 'startDate',
      limit: CALENDAR_MAX_EVENTS,
      depth: 1,
    })) as unknown as { docs: Doc[] }
    const visible = await excludeProtected('events', docs.filter((d) => !d.trashedAt) as never) as unknown as Doc[]
    const out: CalEvent[] = []
    for (const d of visible) {
      if (!d.slug || !d.title || !d.startDate) continue
      const summary = (d.summary ?? '').trim()
      const cat = categorise(d.title, summary, opts.rules, opts.fallback)
      const img = d.coverImage && typeof d.coverImage === 'object' ? d.coverImage.url ?? '' : ''
      out.push({
        id: String(d.id),
        slug: d.slug,
        title: d.title,
        start: d.startDate,
        end: d.endDate && d.endDate >= d.startDate ? d.endDate : d.startDate,
        summary,
        venue: [d.location?.venueName, d.location?.address].filter(Boolean).join(', '),
        online: !!d.location?.isOnline,
        image: img,
        paid: d.eventType === 'paid',
        category: cat.category,
        color: cat.color,
        tags: extractTags(`${d.title} ${summary}`),
      })
    }
    return out
  } catch {
    return []
  }
}
