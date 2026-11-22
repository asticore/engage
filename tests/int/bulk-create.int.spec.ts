import { describe, expect, it } from 'vitest'

import { applyBulkDefaults, creationOrder, cycleRefs, emptyExisting, parseBulkInput, planBulk } from '@/features/bulkCreate/plan'
import { runBulk, undoBulk, type BulkEngine } from '@/features/bulkCreate/run'

describe('bulk create plan', () => {
  it('reads titles one per line and CSV with a header', () => {
    expect(parseBulkInput('About\n\nContact\n').rows.map((r) => r.title)).toEqual(['About', 'Contact'])
    const csv = parseBulkInput('title,slug,parent,template\nTeam,team,about,Landing\n')
    expect(csv.rows[0]).toMatchObject({ title: 'Team', slug: 'team', parent: 'about', template: 'Landing' })
    expect(parseBulkInput('  ').errors.length).toBe(1)
  })
  it('flags clashes before anything is created', () => {
    const existing = emptyExisting()
    existing.slugs.add('about')
    const plan = planBulk('pages', parseBulkInput('About\nNews\nNews\n').rows, existing)
    expect(plan.map((p) => p.ok)).toEqual([false, true, false])
    expect(plan[0].problems[0]).toContain('already used')
    expect(plan[2].problems[0]).toContain('used again')
  })
  it('resolves parents and templates, and flags unknown ones', () => {
    const existing = emptyExisting()
    existing.pageIds.set('services', 7)
    existing.slugs.add('services')
    existing.templates.set('landing', 3)
    const rows = parseBulkInput('title,parent,template\nWeb,services,landing\nSeo,web,\nLost,nowhere,\nBad,,missing\n').rows
    const plan = planBulk('pages', rows, existing)
    expect(plan[0]).toMatchObject({ ok: true, parentId: 7, templateId: 3 })
    expect(plan[1]).toMatchObject({ ok: true, batchParent: 'web' })
    expect(plan[2].ok).toBe(false)
    expect(plan[3].ok).toBe(false)
    expect(creationOrder(plan).map((p) => p.slug)).toEqual(['web', 'seo'])
  })
  it('detects parents that point at each other', () => {
    const plan = planBulk('pages', parseBulkInput('title,parent\nA,b\nB,a\n').rows, emptyExisting())
    expect(cycleRefs(plan).length).toBe(2)
  })
  it('requires unique product titles', () => {
    const existing = emptyExisting()
    existing.titles.add('mug')
    const plan = planBulk('products', parseBulkInput('Mug\nCup\n').rows, existing)
    expect(plan.map((p) => p.ok)).toEqual([false, true])
  })
})

const fakeEngine = () => {
  const docs: Record<string, unknown>[] = []
  const engine: BulkEngine = {
    find: async (a) => {
      const where = a.where as { id?: { equals: number } } | undefined
      return { docs: where?.id ? docs.filter((d) => d.id === where.id!.equals) : a.collection === 'pages' ? docs : [] }
    },
    create: async (a) => {
      const doc = { id: docs.length + 1, createdAt: new Date().toISOString(), ...(a.data as object) }
      docs.push(doc)
      return doc
    },
    delete: async (a) => {
      docs.splice(docs.findIndex((d) => d.id === a.id), 1)
    },
  }
  return { engine, docs }
}

describe('bulk create run and undo', () => {
  it('creates drafts with parents first, then undoes them', async () => {
    const { engine, docs } = fakeEngine()
    const result = await runBulk(engine, {}, 'pages', parseBulkInput('title,parent\nChild,parent-page\nParent page,\n').rows)
    expect(result.created.map((c) => c.slug)).toEqual(['parent-page', 'child'])
    expect(docs[1].parent).toBe(1)
    expect(docs.every((d) => d._status === 'draft')).toBe(true)
    docs[0]._status = 'published'
    const undone = await undoBulk(engine, {}, 'pages', result.created.map((c) => c.id), new Date())
    expect(undone.removed).toBe(1)
    expect(undone.kept).toEqual([{ id: 1, reason: 'It has been published.' }])
  })
  it('keeps drafts older than a day', async () => {
    const { engine, docs } = fakeEngine()
    await runBulk(engine, {}, 'pages', parseBulkInput('Old').rows)
    const undone = await undoBulk(engine, {}, 'pages', [1], new Date(Date.now() + 2 * 86_400_000))
    expect(undone.removed).toBe(0)
    expect(docs.length).toBe(1)
  })
  it('applies the shared parent and template only to rows without their own', () => {
    const rows = applyBulkDefaults(parseBulkInput('title,parent\nA,\nB,other\n').rows, { parent: 'services', template: '3' })
    expect(rows.map((r) => [r.parent, r.template])).toEqual([['services', '3'], ['other', '3']])
  })
  it('can publish and keeps a title written in another language as a translation', async () => {
    const { engine, docs } = fakeEngine()
    await runBulk(engine, {}, 'pages', parseBulkInput('Uber uns').rows, { status: 'published', locale: 'de', defaultLocale: 'en-AU' })
    expect(docs[0]._status).toBe('published')
    expect(docs[1]).toMatchObject({ locale: 'de', sourceKind: 'collection', sourceId: 'pages:1', fieldPath: 'title' })
  })
})
