import { describe, expect, it } from 'vitest'

import { convertLegacyTree, countLegacy, modernizeBlocks } from '@/features/legacyBlocks/convertTree'
import { convertLegacyDocuments, scanLegacyBlocks, undoLegacyBatch, type BackupStore } from '@/features/legacyBlocks/service'
import { collectFaqBlocks } from '@/features/seo/pageSchemaData'
import { annotatePage } from '@/features/editScreens/toc'
import { getElementDef } from '@/lib/elements/registry'
import { SITE_ELEMENT_TYPES } from '@/lib/elements/wave38Defs'
import { parseFaqIds } from '@/components/blocks/elements/LegacyReplacementServer'

const para = { root: { type: 'root', children: [] } }
const legacy = () => [
  { id: 'a', blockType: 'richText', content: para, design: { bgColor: '#fff' } },
  { id: 'b', blockType: 'eventGrid', heading: 'Events', limit: 5, showPast: true },
  { id: 'c', blockType: 'faq', heading: 'FAQ', source: 'manual', faqs: [3, { id: 4 }] },
  { id: 'd', blockType: 'productGrid', heading: 'Shop', category: 'jewellery', limit: 2 },
  { id: 'e', blockType: 'toc', title: 'Jump', levels: 'h2', collapsible: false },
  { id: 'f', blockType: 'section', columns: [{ blocks: [{ blockType: 'richText', content: para }, { blockType: 'element', elementType: 'heading', props: {} }] }] },
]

describe('legacy block conversion (Task 13 / 32b)', () => {
  it('counts every legacy block, nested ones included', () => {
    expect(countLegacy(legacy())).toEqual({ richText: 2, eventGrid: 1, faq: 1, productGrid: 1, toc: 1 })
  })

  it('converts each type onto its element and keeps the values', () => {
    const result = convertLegacyTree(legacy())
    expect(result.changed).toBe(true)
    expect(result.skipped).toBe(0)
    const json = JSON.stringify(result.blocks)
    expect(json).not.toMatch(/"blockType":"(richText|eventGrid|faq|productGrid|toc)"/)
    const blocks = result.blocks as { columns: { blocks: { elementType: string; props: Record<string, unknown> }[] }[]; design?: Record<string, unknown> }[]
    const [text, events, faq, products, toc, nested] = blocks
    expect(text.columns[0].blocks[0].elementType).toBe('text-editor')
    expect(text.design?.bgColor).toBe('#fff')
    expect(events.columns[0].blocks[0]).toMatchObject({ elementType: 'event-grid', props: { heading: 'Events', limit: 5, showPast: true } })
    expect(faq.columns[0].blocks[0].props).toMatchObject({ source: 'manual', faqs: '3,4' })
    expect(products.columns[0].blocks[0].props).toMatchObject({ category: 'jewellery', limit: 2 })
    expect(toc.columns[0].blocks[0].props).toMatchObject({ auto: true, levels: 'h2', collapsible: false, title: 'Jump' })
    expect((nested.columns[0].blocks[0] as unknown as { blockType: string }).blockType).toBe('section')
  })

  it('storage keys do not leak into the new sections as text', () => {
    const [section] = convertLegacyTree([{ id: 'abc', blockName: 'x', blockType: 'eventGrid', heading: 'H' }]).blocks as { columns: { blocks: unknown[] }[] }[]
    expect(section.columns[0].blocks).toHaveLength(1)
  })

  it('is idempotent: a second run changes nothing', () => {
    const once = convertLegacyTree(legacy())
    const twice = convertLegacyTree(once.blocks)
    expect(twice.changed).toBe(false)
    expect(twice.blocks).toBe(once.blocks)
    expect(countLegacy(once.blocks)).toEqual({})
  })

  it('modernizeBlocks leaves blocks with nothing legacy alone', () => {
    const list = [{ blockType: 'element', elementType: 'heading', props: {} }]
    expect(modernizeBlocks(list)).toBe(list)
  })

  it('the replacement elements exist and read live data', () => {
    for (const type of ['event-grid', 'faq-list', 'product-grid']) {
      expect(getElementDef(type)).toBeTruthy()
      expect(SITE_ELEMENT_TYPES.has(type)).toBe(true)
    }
    expect(parseFaqIds('1, 2,x y,abc')).toEqual([1, 2, 'abc'])
  })

  it('FAQ structured data still finds converted and nested FAQs', () => {
    const converted = convertLegacyTree(legacy()).blocks as unknown[]
    const found = collectFaqBlocks(converted)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ source: 'manual', faqs: [3, 4] })
  })

  it('an automatic table of contents element receives the page headings', () => {
    const heading = { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'First part' }] }
    const page = annotatePage({
      body: { root: { children: [heading] } },
      blocks: [{ blockType: 'element', elementType: 'toc', props: { auto: true } }, { blockType: 'element', elementType: 'toc', props: { auto: false } }],
    })
    const [auto, manual] = page.blocks as { props: Record<string, unknown> }[]
    expect(auto.props.headings).toEqual([{ id: 'first-part', level: 2, text: 'First part' }])
    expect(manual.props.headings).toBeUndefined()
  })
})

type Doc = Record<string, unknown>
function fakeEngine(data: Record<string, Doc[]>) {
  const updates: { collection: string; id: unknown; data: Doc }[] = []
  return {
    updates,
    engine: {
      find: async (args: Record<string, unknown>) => {
        const docs = data[args.collection as string]
        if (!docs) throw new Error('no such collection')
        const page = (args.page as number) || 1
        const limit = args.limit as number
        return { docs: docs.slice((page - 1) * limit, page * limit) }
      },
      update: async (args: Record<string, unknown>) => {
        updates.push({ collection: args.collection as string, id: args.id, data: args.data as Doc })
        const doc = data[args.collection as string].find((d) => d.id === args.id)
        if (doc) Object.assign(doc, args.data)
      },
    },
  }
}
const memoryStore = (): BackupStore & { files: Map<string, string> } => {
  const files = new Map<string, string>()
  return { files, put: async (k, t) => void files.set(k, t), get: async (k) => files.get(k) ?? null }
}

describe('legacy block report, bulk conversion and undo', () => {
  const make = () => fakeEngine({
    pages: [{ id: 1, title: 'Home', blocks: legacy() }, { id: 2, title: 'Clean', blocks: [{ blockType: 'section', columns: [] }] }],
    posts: [{ id: 7, title: 'Post', layout: [{ blockType: 'faq', source: 'category' }] }],
    products: [], 'page-templates': [], 'site-templates': [], 'reusable-sections': [],
  })

  it('the report counts without writing', async () => {
    const { engine, updates } = make()
    const scan = await scanLegacyBlocks(engine)
    expect(scan.total).toBe(7)
    expect(scan.surfaces.find((s) => s.collection === 'pages')).toMatchObject({ documents: 2, withLegacy: 1 })
    expect(scan.documents.map((d) => d.id)).toEqual([1, 7])
    expect(updates).toHaveLength(0)
  })

  it('a surface that cannot be read is reported, not thrown', async () => {
    const { engine } = fakeEngine({ pages: [] })
    const scan = await scanLegacyBlocks(engine)
    expect(scan.surfaces.find((s) => s.collection === 'posts')?.error).toBeTruthy()
  })

  it('preview changes nothing and creates no backup', async () => {
    const { engine, updates } = make()
    const store = memoryStore()
    const report = await convertLegacyDocuments(engine, store, {})
    expect(report.dryRun).toBe(true)
    expect(report.batchId).toBeNull()
    expect(report.entries.every((e) => e.status === 'would-convert')).toBe(true)
    expect(updates).toHaveLength(0)
    expect(store.files.size).toBe(0)
  })

  it('convert saves a backup first, writes only changed documents and then finds nothing left', async () => {
    const { engine, updates } = make()
    const store = memoryStore()
    const report = await convertLegacyDocuments(engine, store, { execute: true })
    expect(report.errors).toBe(0)
    expect(report.total).toBe(7)
    expect(store.files.size).toBe(1)
    expect(updates.map((u) => u.id)).toEqual([1, 7])
    expect((await scanLegacyBlocks(engine)).total).toBe(0)
    const again = await convertLegacyDocuments(engine, store, { execute: true })
    expect(again.entries).toHaveLength(0)
    expect(store.files.size).toBe(1)
  })

  it('a failed backup stops everything', async () => {
    const { engine, updates } = make()
    const report = await convertLegacyDocuments(engine, { put: async () => { throw new Error('r2 down') }, get: async () => null }, { execute: true })
    expect(updates).toHaveLength(0)
    expect(report.errors).toBe(2)
  })

  it('one document can be converted on its own', async () => {
    const { engine, updates } = make()
    await convertLegacyDocuments(engine, memoryStore(), { execute: true, collection: 'posts', id: 7 })
    expect(updates.map((u) => u.id)).toEqual([7])
  })

  it('undo restores the old value of every document in the batch', async () => {
    const { engine } = make()
    const store = memoryStore()
    const before = JSON.stringify(legacy())
    const report = await convertLegacyDocuments(engine, store, { execute: true })
    const undo = await undoLegacyBatch(engine, store, report.batchId as string)
    expect(undo).toMatchObject({ ok: true, restored: 2 })
    expect((await scanLegacyBlocks(engine)).total).toBe(7)
    const page = (await engine.find({ collection: 'pages', limit: 10, page: 1 })).docs?.[0]
    expect(JSON.stringify(page?.blocks)).toBe(before)
  })

  it('undo refuses a bad batch id and an unknown batch', async () => {
    const { engine } = make()
    expect((await undoLegacyBatch(engine, memoryStore(), '../etc')).ok).toBe(false)
    expect((await undoLegacyBatch(engine, memoryStore(), '20260101T000000Z-abcd')).reason).toMatch(/No backup/)
  })
})
