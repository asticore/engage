import { beforeEach, describe, expect, it, vi } from 'vitest'

import { decideChange, fromGoogle, pickCalendar, toGoogle } from '@/features/gcalSync/map'
import type { CalendarApi } from '@/features/gcalSync/api'

const state = vi.hoisted(() => ({
  cfg: { enabled: true, calendarId: 'primary', rules: '', intervalMin: 15, tokens: {} as Record<string, string>, lastRunAt: null as string | null },
  links: [] as { eventId: string; calendarId: string; googleId: string; syncedAt: string }[],
  log: [] as string[],
}))
vi.mock('@/features/gcalSync/store', () => ({
  readConfig: async () => state.cfg,
  writeConfig: async (_d: unknown, n: Record<string, unknown>) => Object.assign(state.cfg, n),
  allLinks: async () => [...state.links],
  saveLink: async (_d: unknown, l: (typeof state.links)[number]) => {
    state.links = state.links.filter((x) => x.eventId !== l.eventId && !(x.calendarId === l.calendarId && x.googleId === l.googleId))
    state.links.push(l)
  },
  dropLink: async (_d: unknown, id: string) => {
    state.links = state.links.filter((x) => x.eventId !== id)
  },
  addLog: async (_d: unknown, level: string, message: string) => {
    state.log.push(`${level}:${message}`)
  },
}))
import { runSync } from '@/features/gcalSync/run'

describe('34j map rules', () => {
  it('converts an event to Google with UTC and our id', () => {
    const g = toGoogle({ id: 7, title: 'Talk', startDate: '2026-12-01T10:00:00Z', endDate: '2026-12-01T11:00:00Z', venueName: 'Hall', address: '1 Road' })
    expect(g.start).toEqual({ dateTime: '2026-12-01T10:00:00.000Z', timeZone: 'UTC' })
    expect(g.location).toBe('Hall, 1 Road')
    expect(g.extendedProperties?.private?.engageId).toBe('7')
  })
  it('reads timed and all-day Google events', () => {
    expect(fromGoogle({ summary: 'A', start: { dateTime: '2026-12-01T10:00:00+02:00' }, end: { dateTime: '2026-12-01T11:00:00+02:00' } })?.startDate).toBe('2026-12-01T08:00:00.000Z')
    const day = fromGoogle({ summary: 'B', start: { date: '2026-12-02' }, end: { date: '2026-12-03' } })
    expect(day?.endDate).toBe('2026-12-02T23:59:59.000Z')
    expect(fromGoogle({ summary: 'x' })).toBeNull()
  })
  it('chooses a calendar by keyword', () => {
    expect(pickCalendar({ title: 'Pottery Workshop' }, 'workshop | w@x', 'primary')).toBe('w@x')
    expect(pickCalendar({ title: 'Party' }, 'workshop | w@x', 'primary')).toBe('primary')
  })
  it('last edit wins and flags conflicts', () => {
    const s = '2026-12-01T10:00:00Z'
    expect(decideChange(s, '2026-12-01T09:00:00Z', '2026-12-01T09:00:00Z')).toEqual({ change: 'none', conflict: false })
    expect(decideChange(s, '2026-12-01T11:00:00Z', null).change).toBe('push')
    expect(decideChange(s, null, '2026-12-01T11:00:00Z').change).toBe('pull')
    expect(decideChange(s, '2026-12-01T11:00:00Z', '2026-12-01T12:00:00Z')).toEqual({ change: 'pull', conflict: true })
    expect(decideChange(s, '2026-12-01T13:00:00Z', '2026-12-01T12:00:00Z')).toEqual({ change: 'push', conflict: true })
  })
})

describe('34j runSync', () => {
  let docs: Record<string, unknown>[]
  let calls: string[]
  let gItems: Record<string, unknown>[]
  const api: CalendarApi = {
    list: async () => ({ items: gItems as never, nextSyncToken: 'tok1' }),
    insert: async (_c, e) => {
      calls.push(`insert:${e.summary}`)
      return { id: 'g-new' }
    },
    patch: async (_c, id) => {
      calls.push(`patch:${id}`)
      return {}
    },
    remove: async (_c, id) => {
      calls.push(`remove:${id}`)
    },
  }
  const engine = {
    find: async (a: { where?: { id?: { equals: string } } }) => ({ docs: a.where?.id ? docs.filter((d) => String(d.id) === a.where!.id!.equals) : docs }),
    create: async (a: { data: Record<string, unknown> }) => {
      const d: Record<string, unknown> = { id: 100, ...a.data, updatedAt: new Date().toISOString() }
      docs.push(d)
      calls.push(`create:${d.title}`)
      return d
    },
    update: async (a: { id: string; data: Record<string, unknown> }) => {
      calls.push(`update:${a.id}`)
      Object.assign(docs.find((d) => String(d.id) === String(a.id))!, a.data)
    },
    delete: async (a: { id: string }) => {
      calls.push(`delete:${a.id}`)
      docs = docs.filter((d) => String(d.id) !== String(a.id))
    },
  }
  beforeEach(() => {
    state.cfg = { enabled: true, calendarId: 'primary', rules: '', intervalMin: 15, tokens: {}, lastRunAt: null }
    state.links = []
    state.log = []
    docs = []
    calls = []
    gItems = []
  })
  const run = () => runSync({ engine, db: {} as never, api })

  it('imports an event created in Google', async () => {
    gItems = [{ id: 'g1', summary: 'From Google', updated: new Date().toISOString(), start: { dateTime: '2026-12-05T10:00:00Z' }, end: { dateTime: '2026-12-05T11:00:00Z' } }]
    const r = await run()
    expect(r.pulledNew).toBe(1)
    expect(calls).toContain('create:From Google')
    expect(state.links[0].googleId).toBe('g1')
    expect(state.cfg.tokens.primary).toBe('tok1')
  })
  it('sends a site event to Google, then a later edit patches it', async () => {
    docs = [{ id: 1, title: 'Local', startDate: '2026-12-06T10:00:00Z', updatedAt: '2026-12-01T00:00:00Z' }]
    expect((await run()).pushedNew).toBe(1)
    expect(state.links[0]).toMatchObject({ eventId: '1', googleId: 'g-new' })
    state.links[0].syncedAt = '2026-12-02T00:00:00Z'
    docs[0].updatedAt = '2026-12-03T00:00:00Z'
    expect((await run()).pushedChanged).toBe(1)
    expect(calls).toContain('patch:g-new')
  })
  it('deletes both ways', async () => {
    docs = [{ id: 2, title: 'Gone here', startDate: '2026-12-06T10:00:00Z', updatedAt: '2026-12-01T00:00:00Z' }]
    state.links = [{ eventId: '2', calendarId: 'primary', googleId: 'g2', syncedAt: '2026-12-02T00:00:00Z' }]
    gItems = [{ id: 'g2', status: 'cancelled' }]
    expect((await run()).pulledDeleted).toBe(1)
    expect(docs).toHaveLength(0)
    state.links = [{ eventId: '9', calendarId: 'primary', googleId: 'g9', syncedAt: '2026-12-02T00:00:00Z' }]
    gItems = []
    expect((await run()).pushedDeleted).toBe(1)
    expect(calls).toContain('remove:g9')
  })
  it('logs a conflict and lets the newer Google edit win', async () => {
    docs = [{ id: 3, title: 'Old', startDate: '2026-12-06T10:00:00Z', updatedAt: '2026-12-03T00:00:00Z' }]
    state.links = [{ eventId: '3', calendarId: 'primary', googleId: 'g3', syncedAt: '2026-12-02T00:00:00Z' }]
    gItems = [{ id: 'g3', summary: 'New', updated: '2026-12-04T00:00:00Z', start: { dateTime: '2026-12-06T10:00:00Z' }, end: { dateTime: '2026-12-06T11:00:00Z' } }]
    const r = await run()
    expect(r.conflicts).toBe(1)
    expect(docs[0].title).toBe('New')
    expect(state.log.some((l) => l.startsWith('conflict:'))).toBe(true)
  })
  it('does nothing when switched off', async () => {
    state.cfg.enabled = false
    docs = [{ id: 4, title: 'x', startDate: '2026-12-06T10:00:00Z' }]
    await run()
    expect(calls).toEqual([])
  })
})
