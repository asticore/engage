import { describe, expect, it } from 'vitest'

import { cleanCollection, cleanDocId, cleanWhen, dueReleases, undoTarget } from '@/features/releases/core'
import { publishRelease, undoRelease } from '@/features/releases/run'
import type { Release } from '@/features/releases/store'

const status: Record<string, string> = {}
const calls: string[] = []
const db = {
  prepare: (sql: string) => ({
    bind: (...v: unknown[]) => ({
      first: async (): Promise<null> => null,
      all: async (): Promise<{ results: never[] }> => ({ results: [] }),
      run: async () => {
        calls.push(`${sql.slice(0, 22)}|${v.join(',')}`)
      },
    }),
  }),
}
const engine = {
  findByID: async (a: { collection: string; id: number }) => (a.id === 99 ? null : { _status: status[`${a.collection}${a.id}`] ?? 'draft' }),
  update: async (a: { collection: string; id: number; data: { _status: string } }) => {
    if (a.id === 13) throw new Error('boom')
    status[`${a.collection}${a.id}`] = a.data._status
  },
}
const rel = (items: Release['items']): Release => ({ id: 1, name: 'R', publishAt: null, status: 'open', createdAt: '', doneAt: null, note: null, items })

describe('34h6 releases', () => {
  it('cleans inputs', () => {
    expect(cleanCollection('pages')).toBe('pages')
    expect(cleanCollection('users')).toBeNull()
    expect(cleanDocId('5')).toBe(5)
    expect(cleanDocId('x')).toBeNull()
    expect(cleanWhen('')).toBeNull()
    expect(cleanWhen('2026-12-01T10:00:00Z')).toBe('2026-12-01T10:00:00.000Z')
  })
  it('finds due open releases soonest first', () => {
    const rows = [
      { status: 'open' as const, publishAt: '2026-12-02T00:00:00Z' },
      { status: 'open' as const, publishAt: '2026-12-01T00:00:00Z' },
      { status: 'published' as const, publishAt: '2026-11-01T00:00:00Z' },
      { status: 'open' as const, publishAt: null },
      { status: 'open' as const, publishAt: '2027-01-01T00:00:00Z' },
    ]
    expect(dueReleases(rows, '2026-12-05T00:00:00Z').map((r) => r.publishAt)).toEqual(['2026-12-01T00:00:00Z', '2026-12-02T00:00:00Z'])
    expect(undoTarget({ before: 'published' })).toBe('published')
    expect(undoTarget({ before: null })).toBe('draft')
  })
  it('publishes all items together, then undoes', async () => {
    const r = rel([{ collection: 'pages', docId: 1, before: null }, { collection: 'posts', docId: 2, before: null }])
    expect((await publishRelease(engine as never, db as never, r, 'now')).ok).toBe(true)
    expect(status.pages1).toBe('published')
    expect(status.posts2).toBe('published')
    await undoRelease(engine as never, db as never, { ...r, items: r.items.map((i) => ({ ...i, before: 'draft' as const })) }, 'now')
    expect(status.pages1).toBe('draft')
  })
  it('is all or nothing when one item fails', async () => {
    status.pages20 = 'draft'
    const res = await publishRelease(engine as never, db as never, rel([{ collection: 'pages', docId: 20, before: null }, { collection: 'pages', docId: 13, before: null }]), 'now')
    expect(res.ok).toBe(false)
    expect(status.pages20).toBe('draft')
  })
  it('leaves already live documents live on undo', async () => {
    status.pages30 = 'published'
    await undoRelease(engine as never, db as never, rel([{ collection: 'pages', docId: 30, before: 'published' }]), 'now')
    expect(status.pages30).toBe('published')
  })
})
