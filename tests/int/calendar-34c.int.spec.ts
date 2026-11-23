import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CalendarClient } from '@/components/blocks/elements/CalendarClient'
import { buildEventsCalendar } from '@/features/editScreens/ics'
import { addDays, categorise, dayKeyIn, eventsOnDay, extractTags, filterEvents, googleCalendarUrl, monthGrid, parseRules, weekStart, type CalEvent } from '@/features/calendar/model'
import { getElementDef } from '@/lib/elements/registry'

const ev = (id: string, start: string, extra: Partial<CalEvent> = {}): CalEvent => ({ id, slug: `e${id}`, title: `Event ${id}`, start, end: start, summary: '', venue: '', online: false, image: '', paid: false, category: 'Events', color: '', tags: [], ...extra })

describe('calendar model', () => {
  it('parses category rules and tags', () => {
    const rules = parseRules('workshop | Learning | #ff0000\nbad line\nsale | Shop | nocolour')
    expect(rules).toHaveLength(2)
    expect(rules[1]!.color).toBe('')
    expect(categorise('Pottery Workshop', '', rules, { category: 'Events', color: '#000' })).toEqual({ category: 'Learning', color: '#ff0000' })
    expect(categorise('Party', '', rules, { category: 'Events', color: '#000' }).category).toBe('Events')
    expect(extractTags('Join us #Spring #a')).toEqual(['spring'])
  })
  it('builds grids by first day of week', () => {
    expect(weekStart('2026-11-25', 1)).toBe('2026-11-23')
    expect(weekStart('2026-11-25', 0)).toBe('2026-11-22')
    const rows = monthGrid(2026, 10, 1)
    expect(rows[0]![0]).toBe('2026-10-26')
    expect(rows.every((r) => r.length === 7)).toBe(true)
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
  it('puts multi-day events on every day and honours the time zone', () => {
    const e = ev('1', '2026-11-10T10:00:00Z', { end: '2026-11-12T10:00:00Z' })
    expect(eventsOnDay([e], '2026-11-11', 'UTC')).toHaveLength(1)
    expect(eventsOnDay([e], '2026-11-13', 'UTC')).toHaveLength(0)
    expect(dayKeyIn('2026-11-10T23:30:00Z', 'Australia/Sydney')).toBe('2026-11-11')
    expect(dayKeyIn('2026-11-10T23:30:00Z', 'Not/AZone')).toBe('2026-11-10')
  })
  it('filters by category and tag', () => {
    const list = [ev('1', '2026-11-10T10:00:00Z', { category: 'A', tags: ['x'] }), ev('2', '2026-11-11T10:00:00Z', { category: 'B' })]
    expect(filterEvents(list, { category: 'A' })).toHaveLength(1)
    expect(filterEvents(list, { tag: 'x' })).toHaveLength(1)
    expect(filterEvents(list, { q: 'event 2' })).toHaveLength(1)
  })
  it('makes a Google link and a multi event ICS feed', () => {
    expect(googleCalendarUrl(ev('1', '2026-11-10T10:00:00Z', { venue: 'Hall' }), 'https://s.test')).toContain('dates=20261110T100000Z%2F20261110T100000Z')
    const ics = buildEventsCalendar([{ id: 1, slug: 'a', title: 'A', startDate: '2026-11-10T10:00:00Z' }, { id: 2, slug: 'b', title: 'B', startDate: '2026-11-11T10:00:00Z' }, { id: 3, title: 'no slug' }], 'https://s.test')
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(ics.match(/BEGIN:VCALENDAR/g)).toHaveLength(1)
  })
})

describe('calendar element', () => {
  it('is in the library', () => {
    expect(getElementDef('calendar')).toBeTruthy()
  })
  it('renders views, filters and the subscribe link', () => {
    const out = renderToStaticMarkup(React.createElement(CalendarClient, {
      events: [ev('1', '2026-11-10T10:00:00Z', { category: 'A' }), ev('2', '2026-11-11T10:00:00Z', { category: 'B' })],
      views: ['month', 'agenda'], defaultView: 'month', firstDay: 1, hour12: true, timeZone: 'UTC', density: 'compact', showFilters: true, colorByCategory: true, feedUrl: '/api/events/feed', today: '2026-11-10',
    }))
    expect(out).toContain('be-cal__month')
    expect(out).toContain('Agenda')
    expect(out).toContain('Subscribe to this calendar')
    expect(out).toContain('Category')
  })
})
