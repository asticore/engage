import { describe, expect, it } from 'vitest'

import { isoDay, toFeedItems } from '@/features/calendar/timelineFeed'
import { getElementDef } from '@/lib/elements/registry'
import { SITE_ELEMENT_TYPES } from '@/lib/elements/wave38Defs'

describe('34a2 timeline from events or posts', () => {
  it('registers as a server element', () => {
    expect(getElementDef('timeline-feed')).toBeTruthy()
    expect(SITE_ELEMENT_TYPES.has('timeline-feed')).toBe(true)
  })
  it('maps events and skips incomplete or trashed ones', () => {
    const items = toFeedItems('events', [
      { title: 'Talk', slug: 'talk', summary: ' About x ', startDate: '2026-12-05T10:00:00Z' },
      { title: 'No slug', startDate: '2026-12-06T10:00:00Z' },
      { title: 'Gone', slug: 'gone', startDate: '2026-12-07T10:00:00Z', trashedAt: '2026-12-01T00:00:00Z' },
      { title: 'No date', slug: 'nd' },
    ], 'More')
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ date: '2026-12-05', group: '2026', text: 'About x', url: '/events/talk', linkLabel: 'More' })
  })
  it('maps posts to blog links using the published date and excerpt', () => {
    const [p] = toFeedItems('posts', [{ title: 'Hello', slug: 'hello', excerpt: 'Hi', publishedDate: '2026-01-02T00:00:00Z' }], 'Read')
    expect(p).toMatchObject({ date: '2026-01-02', url: '/blog/hello', text: 'Hi' })
    expect(isoDay('nonsense')).toBe('')
  })
})
