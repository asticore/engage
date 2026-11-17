// @vitest-environment node
// Composite products ("build your own kit"): steps, picks, pricing, stock snapshot and validation, with a fake product table.
import { describe, expect, it } from 'vitest'

import { checkCompositePicks, compositeErrors, compositeOptionCents, compositeSteps, compositeSummary, parseCompositePicks, storeCompositePicks } from '@/features/ecommerce/lib/composite'
import { compositeItemErrors, compositeStorefront, resolveComposite } from '@/features/ecommerce/server/composite'

type Doc = Record<string, unknown> & { id: number }

const NOW = new Date('2026-11-17T12:00:00Z')

const products: Doc[] = [
  { id: 1, title: 'Ethiopia', productType: 'simple', priceInAUD: 20, manageStock: true, stockQty: 5, backorders: 'no', stockStatus: 'instock', _status: 'published' },
  { id: 2, title: 'Colombia', productType: 'simple', priceInAUD: 18, manageStock: false, stockStatus: 'instock', _status: 'published' },
  { id: 3, title: 'Mug', productType: 'simple', priceInAUD: 12, manageStock: false, stockStatus: 'instock', _status: 'published' },
  { id: 4, title: 'Hidden', productType: 'simple', priceInAUD: 5, _status: 'draft' },
  { id: 5, title: 'Inner bundle', productType: 'bundle', priceInAUD: 5, _status: 'published' },
  { id: 6, title: 'Biscuit', productType: 'simple', priceInAUD: 4, manageStock: false, stockStatus: 'instock', _status: 'published' },
  { id: 7, title: 'Gone', productType: 'simple', priceInAUD: 9, manageStock: true, stockQty: 0, backorders: 'no', stockStatus: 'outofstock', _status: 'published' },
]

const engine = { findByID: async (args: unknown): Promise<Doc | null> => products.find((p) => p.id === (args as { id: number }).id) ?? null }

const kit = (overrides: Partial<Doc> = {}): Doc => ({
  id: 10,
  title: 'Coffee kit',
  productType: 'composite',
  priceInAUD: 30,
  compositeOptions: [
    { component: 'Coffee', product: 1, priceMode: 'included', isDefault: true },
    { component: 'Coffee', product: 2, priceMode: 'add', priceValue: 3 },
    { component: 'Mug', product: 3, priceMode: 'discount', priceValue: 50 },
    { component: 'Mug', product: 6, priceMode: 'add' },
    { component: 'Extras', product: 6, priceMode: 'included' },
    { component: 'Extras', product: 3, priceMode: 'add', priceValue: 1 },
  ],
  compositeRules: [
    { component: 'Mug', description: 'Pick a mug', required: false },
    { component: 'extras', required: true, minChoices: 1, maxChoices: 2 },
  ],
  _status: 'published',
  ...overrides,
})

describe('composite steps and rules', () => {
  it('groups items by step in first-seen order and applies the rules ignoring case', () => {
    const steps = compositeSteps(kit().compositeOptions, kit().compositeRules)
    expect(steps.map((s) => s.label)).toEqual(['Coffee', 'Mug', 'Extras'])
    expect(steps[0]).toMatchObject({ required: true, min: 1, max: 1 })
    expect(steps[1]).toMatchObject({ required: false, min: 0, max: 1, description: 'Pick a mug' })
    expect(steps[2]).toMatchObject({ required: true, min: 1, max: 2 })
  })

  it('drops rows with no product or step, merges a repeated product, and never allows more than is on offer', () => {
    const steps = compositeSteps(
      [
        { component: 'A', product: 1 },
        { component: 'A', product: { id: 1 } },
        { component: '', product: 2 },
        { component: 'B', product: null },
      ],
      [{ component: 'A', maxChoices: 9 }],
    )
    expect(steps).toHaveLength(1)
    expect(steps[0].options).toHaveLength(1)
    expect(steps[0].max).toBe(1)
  })

  it('works out what an item adds', () => {
    expect(compositeOptionCents({ priceMode: 'included', priceValue: 5 }, 2000)).toBe(0)
    expect(compositeOptionCents({ priceMode: 'add', priceValue: 3 }, 2000)).toBe(300)
    expect(compositeOptionCents({ priceMode: 'add', priceValue: null }, 2000)).toBe(2000)
    expect(compositeOptionCents({ priceMode: 'discount', priceValue: 25 }, 2000)).toBe(1500)
    expect(compositeOptionCents({ priceMode: 'discount', priceValue: 150 }, 2000)).toBe(0)
  })

  it('reads and stores picks', () => {
    const picks = parseCompositePicks('[{"c":"Coffee","p":1},{"c":"coffee","p":1},{"c":"Mug"},{"component":"Mug","productId":3}]')
    expect(picks).toEqual([
      { component: 'Coffee', productId: 1 },
      { component: 'Mug', productId: 3 },
    ])
    expect(parseCompositePicks('not json')).toEqual([])
    expect(storeCompositePicks([])).toBeNull()
    expect(parseCompositePicks(storeCompositePicks(picks))).toEqual(picks)
    expect(compositeSummary([{ component: 'Coffee', title: 'Ethiopia' }, { component: 'Extras', title: 'Biscuit' }, { component: 'Extras', title: 'Mug' }])).toBe('Coffee: Ethiopia; Extras: Biscuit, Mug')
  })
})

describe('checking picks', () => {
  const steps = compositeSteps(kit().compositeOptions, kit().compositeRules)

  it('uses defaults for an empty step, and an optional step may stay empty', () => {
    const result = checkCompositePicks(steps, [{ component: 'Extras', productId: 6 }])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.picks).toEqual([{ component: 'Coffee', productId: 1 }, { component: 'Extras', productId: 6 }])
  })

  it('refuses too few, too many, and things that are not on offer', () => {
    expect(checkCompositePicks(steps, [])).toMatchObject({ ok: false, error: 'Please choose an item for Extras.' })
    expect(checkCompositePicks(steps, [{ component: 'Coffee', productId: 1 }, { component: 'Coffee', productId: 2 }, { component: 'Extras', productId: 6 }])).toMatchObject({ ok: false, error: 'Choose only one item for Coffee.' })
    expect(checkCompositePicks(steps, [{ component: 'Coffee', productId: 3 }])).toMatchObject({ ok: false })
    expect(checkCompositePicks(steps, [{ component: 'Nope', productId: 1 }])).toMatchObject({ ok: false })
    expect(checkCompositePicks([], [])).toMatchObject({ ok: false })
  })
})

describe('pricing one kit line', () => {
  const reserve = () => new Map<string, number>()
  const picks = (...rows: Array<[string, number]>) => rows.map(([component, productId]) => ({ component, productId }))

  it('adds the base price and what each pick adds, and snapshots what was picked', async () => {
    const result = await resolveComposite(engine, kit(), picks(['Coffee', 2], ['Mug', 3], ['Extras', 6], ['Extras', 3]), 2, NOW, reserve())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // 30.00 + Colombia add 3.00 + Mug 12.00 less 50% (6.00) + Biscuit included + Mug add 1.00
    expect(result.unitCents).toBe(4000)
    expect(result.contents).toEqual([
      { productId: 2, title: 'Colombia', quantity: 1 },
      { productId: 3, title: 'Mug', quantity: 2 },
      { productId: 6, title: 'Biscuit', quantity: 1 },
    ])
    expect(result.summary).toBe('Coffee: Colombia; Mug: Mug; Extras: Biscuit, Mug')
  })

  it('draws stock for every kit sold and does not let two lines take the last unit', async () => {
    const held = reserve()
    const first = await resolveComposite(engine, kit(), picks(['Coffee', 1], ['Extras', 6]), 4, NOW, held)
    expect(first.ok).toBe(true)
    if (first.ok) expect(first.pools).toEqual([{ key: '1:', available: 5, quantity: 4 }])
    const second = await resolveComposite(engine, kit(), picks(['Coffee', 1], ['Extras', 6]), 2, NOW, held)
    expect(second.ok).toBe(false)
  })

  it('refuses items that are hidden, out of stock, or not simple, and a kit that is not published', async () => {
    const bad = (id: number) => kit({ compositeOptions: [{ component: 'Coffee', product: id }], compositeRules: [] })
    expect((await resolveComposite(engine, bad(4), picks(['Coffee', 4]), 1, NOW, reserve())).ok).toBe(false)
    expect((await resolveComposite(engine, bad(7), picks(['Coffee', 7]), 1, NOW, reserve())).ok).toBe(false)
    expect((await resolveComposite(engine, bad(5), picks(['Coffee', 5]), 1, NOW, reserve())).ok).toBe(false)
    expect((await resolveComposite(engine, kit({ _status: 'draft' }), picks(['Coffee', 1], ['Extras', 6]), 1, NOW, reserve())).ok).toBe(false)
    expect((await resolveComposite(engine, kit(), picks(['Coffee', 1], ['Extras', 6]), 0, NOW, reserve())).ok).toBe(false)
  })

  it('shows the page the steps, what each item adds and what is in stock', async () => {
    const view = await compositeStorefront(engine, kit({ compositeOptions: [...(kit().compositeOptions as unknown[]), { component: 'Extras', product: 7 }] }), NOW)
    expect(view.baseCents).toBe(3000)
    expect(view.steps.map((s) => s.label)).toEqual(['Coffee', 'Mug', 'Extras'])
    expect(view.steps[0].options[1]).toMatchObject({ title: 'Colombia', extraCents: 300, available: true })
    expect(view.steps[2].options.find((o) => o.productId === 7)).toMatchObject({ available: false })
    expect(view.steps[0].options[0]).toMatchObject({ isDefault: true })
  })
})

describe('save-time checks', () => {
  it('needs items, no self, valid percentages and matching rules', () => {
    expect(compositeErrors({ productType: 'simple' })).toEqual([])
    expect(compositeErrors({ productType: 'composite' }).length).toBeGreaterThan(0)
    expect(compositeErrors(kit(), 10)).toEqual([])
    expect(compositeErrors({ ...kit(), compositeOptions: [{ component: 'A', product: 10 }] }, 10).some((e) => /offer itself/.test(e.message))).toBe(true)
    expect(compositeErrors({ ...kit(), compositeOptions: [{ component: 'A', product: 1, priceMode: 'discount', priceValue: 120 }] }).some((e) => /percentage/.test(e.message))).toBe(true)
    expect(compositeErrors({ ...kit(), compositeRules: [{ component: 'Ghost' }] }).some((e) => /does not match/.test(e.message))).toBe(true)
    expect(compositeErrors({ ...kit(), compositeRules: [{ component: 'Mug', minChoices: 3, maxChoices: 1 }] }).some((e) => /most cannot be below/.test(e.message))).toBe(true)
    expect(compositeErrors({ ...kit(), compositeOptions: [{ component: 'A', product: 1, isDefault: true }, { component: 'A', product: 2, isDefault: true }] }).some((e) => /default items/.test(e.message))).toBe(true)
  })

  it('looks the offered products up', async () => {
    expect(await compositeItemErrors(engine, kit())).toEqual([])
    const errors = await compositeItemErrors(engine, kit({ compositeOptions: [{ component: 'A', product: 5 }, { component: 'A', product: 999 }], compositeRules: [] }))
    expect(errors).toHaveLength(2)
  })
})
