// @vitest-environment node
// The asset manager's search SQL against a real (emulated) D1: filters, saved searches and smart collections.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPlatformProxy } from 'wrangler'

import { parseFilters, type SearchContext } from '@/features/dam/search'
import * as store from '@/features/dam/store'
import { consoleLogger } from '@/localapi/logger'
import { runInternalMigrate } from '@/migrations/runInternalMigrate'

describe('asset manager search on a real database', () => {
  let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ D1: D1Database }>>>
  let d1: store.D1
  const ctx: SearchContext = { todayIso: '2027-03-10', warnUntilIso: '2027-04-09' }
  const now = '2027-03-10T10:00:00.000Z'

  beforeAll(async () => {
    proxy = await getPlatformProxy<{ D1: D1Database }>({ persist: false })
    const outcome = await runInternalMigrate(proxy.env.D1, consoleLogger, { provisionAll: true, baseline: false })
    expect(outcome.errorCount).toBe(0)
    d1 = proxy.env.D1 as never as store.D1
    const insert = proxy.env.D1.prepare('INSERT INTO eg_media (id, alt, filename, mime_type, filesize, width, height, folder, caption, credit, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?11)')
    const rows: Array<[number, string, string, string, number, number | null, number | null, string, string, string, string]> = [
      [1, 'A beach at sunset', 'beach.jpg', 'image/jpeg', 200_000, 3000, 2000, 'holiday/summer', 'Golden hour', 'Jo Smith', '2027-01-05T09:00:00.000Z'],
      [2, 'Portrait of a chef', 'chef.png', 'image/png', 50_000, 800, 1200, 'people', '', '', '2027-02-10T09:00:00.000Z'],
      [3, '', 'report.pdf', 'application/pdf', 900_000, null, null, 'documents', 'Quarterly numbers', '', '2027-03-01T09:00:00.000Z'],
      [4, 'Square logo', 'logo.png', 'image/png', 10_000, 500, 500, '', '', '', '2027-03-05T09:00:00.000Z'],
    ]
    for (const r of rows) await insert.bind(...r).run()
    await store.saveRights(d1, 1, { status: 'approved', licenceType: 'RF', licenceTerms: '', credit: '', usageNotes: '', territory: '', releaseNote: '', licenceStart: null, licenceExpiry: '2027-03-20', embargoUntil: null }, now)
    await store.saveRights(d1, 2, { status: 'archived', licenceType: '', licenceTerms: '', credit: '', usageNotes: '', territory: '', releaseNote: '', licenceStart: null, licenceExpiry: null, embargoUntil: null }, now)
    await store.saveMeta(d1, 1, { shoot: 'Summer' }, 'summer', now)
    await store.setSearchText(d1, 3, 'budget forecast ¶doc¶ revenue grew in the third quarter', now)
  }, 600_000)

  afterAll(async () => {
    await proxy.dispose()
  })

  const ids = async (input: Record<string, unknown>, c: SearchContext = ctx): Promise<number[]> => (await store.runSearch(d1, parseFilters(input), c, 1, 50)).docs.map((d) => d.id).sort()

  it('finds by words in name, alt, caption, credit, folder and document text', async () => {
    expect(await ids({ q: 'sunset' })).toEqual([1])
    expect(await ids({ q: 'golden' })).toEqual([1])
    expect(await ids({ q: 'jo smith' })).toEqual([1])
    expect(await ids({ q: 'summer' })).toEqual([1])
    expect(await ids({ q: 'revenue quarter' })).toEqual([3])
    expect(await ids({ q: 'sunset chef' })).toEqual([])
  })
  it('filters by type, folder, size, dates, shape and dimensions', async () => {
    expect(await ids({ type: 'image' })).toEqual([1, 2, 4])
    expect(await ids({ type: 'document' })).toEqual([3])
    expect(await ids({ folder: 'holiday' })).toEqual([1])
    expect(await ids({ sizeMinKb: 100 })).toEqual([1, 3])
    expect(await ids({ from: '2027-03-01', to: '2027-03-05' })).toEqual([3, 4])
    expect(await ids({ orientation: 'portrait' })).toEqual([2])
    expect(await ids({ orientation: 'square' })).toEqual([4])
    expect(await ids({ minWidth: 1000 })).toEqual([1])
  })
  it('filters by status, licence state and custom details', async () => {
    expect(await ids({ status: 'archived' })).toEqual([2])
    expect(await ids({ licence: 'expiring' })).toEqual([1])
    expect(await ids({ licence: 'flagged' })).toEqual([2])
    expect(await ids({ meta: { shoot: 'Summer' } })).toEqual([1])
    expect(await ids({ meta: { shoot: 'Winter' } })).toEqual([])
    expect(await ids({ licence: 'expired' }, { todayIso: '2027-06-01', warnUntilIso: '2027-06-30' })).toEqual([1])
  })
  it('sorts, pages and counts', async () => {
    const page = await store.runSearch(d1, parseFilters({ sort: 'size' }), ctx, 1, 2)
    expect(page.total).toBe(4)
    expect(page.docs.map((d) => d.id)).toEqual([3, 1])
    expect((await store.runSearch(d1, parseFilters({ sort: 'name' }), ctx, 2, 2)).docs.map((d) => d.id)).toEqual([4, 3])
  })
  it('saves searches and keeps a smart collection in step with its search', async () => {
    await store.saveSearch(d1, 'Big files', parseFilters({ sizeMinKb: 100 }), null, now)
    expect((await store.listSavedSearches(d1)).map((s) => s.name)).toEqual(['Big files'])
    const id = await store.saveSmartCollection(d1, 'Images only', parseFilters({ type: 'image' }), now)
    const collection = (await store.listCollections(d1)).find((c) => c.id === id)
    expect(collection).toMatchObject({ smart: true, count: -1 })
    expect((await store.smartCollectionIds(d1, id, ctx)).sort()).toEqual([1, 2, 4])
    await d1.prepare('INSERT INTO eg_media (id, alt, filename, mime_type, filesize, width, height, folder, created_at, updated_at) VALUES (5, \'new\', \'new.jpg\', \'image/jpeg\', 1, 10, 10, \'\', \'2027-03-09T00:00:00Z\', \'2027-03-09T00:00:00Z\')').bind().run()
    expect((await store.smartCollectionIds(d1, id, ctx)).sort()).toEqual([1, 2, 4, 5])
  })
  it('finds a tag and its sub-tags', async () => {
    const parent = Number((await d1.prepare("INSERT INTO eg_media_tags (name, parent_id, color) VALUES ('Products', NULL, '#888888')").bind().run()).meta?.last_row_id)
    const child = Number((await d1.prepare("INSERT INTO eg_media_tags (name, parent_id, color) VALUES ('Summer', ?1, '#888888')").bind(parent).run()).meta?.last_row_id)
    await d1.prepare('INSERT INTO eg_media_tag_links (media_id, tag_id) VALUES (4, ?1)').bind(child).run()
    const tagIds = await store.tagWithChildren(d1, parent)
    expect(tagIds.sort()).toEqual([parent, child].sort())
    expect(await ids({ tagId: parent }, { ...ctx, tagIds })).toEqual([4])
  })
})
