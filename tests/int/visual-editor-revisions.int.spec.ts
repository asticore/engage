import { describe, expect, it } from 'vitest'

import { parseRevisions, relativeTime, revisionsUrl } from '@/views/visualEditor/revisions'

describe('revisionsUrl', () => {
  it('asks for a collection document by parent id', () => {
    expect(revisionsUrl('collection', 'pages', '42')).toBe('/api/pages/versions?where[parent][equals]=42&limit=50&sort=-updatedAt&depth=0')
  })

  it('uses the globals endpoint for a global and needs no id', () => {
    expect(revisionsUrl('global', 'site-settings', undefined)).toBe('/api/globals/site-settings/versions?limit=50&sort=-updatedAt&depth=0')
  })

  it('has nothing to ask for a collection without an id', () => {
    expect(revisionsUrl('collection', 'pages', undefined)).toBeNull()
  })
})

describe('parseRevisions', () => {
  const body = {
    docs: [
      { id: 7, updatedAt: '2026-03-02T10:00:00.000Z', latest: true, version: { _status: 'published', updatedBy: 3, layout: [{ blockType: 'section' }] } },
      { id: 6, updatedAt: '2026-03-01T10:00:00.000Z', latest: false, version: { _status: 'draft', updatedBy: { id: 4, name: 'Ann' }, layout: [] as unknown[] } },
      { id: 5, version: { updatedAt: '2026-02-01T00:00:00.000Z' } },
    ],
  }

  it('reads id, time, status, author and the blocks field', () => {
    const rows = parseRevisions(body, 'layout')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual({
      id: '7',
      updatedAt: '2026-03-02T10:00:00.000Z',
      status: 'published',
      authorId: 3,
      latest: true,
      blocks: [{ blockType: 'section' }],
    })
    expect(rows[1].authorId).toBe(4)
    expect(rows[1].status).toBe('draft')
  })

  it('falls back to the version time and tolerates missing parts', () => {
    const rows = parseRevisions(body, 'layout')
    expect(rows[2].updatedAt).toBe('2026-02-01T00:00:00.000Z')
    expect(rows[2].status).toBeNull()
    expect(rows[2].authorId).toBeNull()
    expect(rows[2].blocks).toBeUndefined()
  })

  it('uses the surface blocks field and gives an empty list for odd input', () => {
    expect(parseRevisions({ docs: [{ id: 1, version: { content: [1] } }] }, 'content')[0].blocks).toEqual([1])
    expect(parseRevisions(null, 'layout')).toEqual([])
    expect(parseRevisions({ docs: 'x' }, 'layout')).toEqual([])
  })
})

describe('relativeTime', () => {
  const now = Date.parse('2026-03-02T12:00:00.000Z')

  it('says minutes, hours and days ago', () => {
    expect(relativeTime('2026-03-02T11:55:00.000Z', now, 'en')).toBe('5 minutes ago')
    expect(relativeTime('2026-03-02T09:00:00.000Z', now, 'en')).toBe('3 hours ago')
    expect(relativeTime('2026-02-28T12:00:00.000Z', now, 'en')).toBe('2 days ago')
  })

  it('says now for the last minute and returns unreadable input as is', () => {
    expect(relativeTime('2026-03-02T11:59:50.000Z', now, 'en')).toBe('now')
    expect(relativeTime('garbage', now, 'en')).toBe('garbage')
  })
})
