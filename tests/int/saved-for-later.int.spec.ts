import { describe, expect, it } from 'vitest'

import { addSaved, MAX_SAVED, parseSaved, removeSaved, type SavedLine } from '@/features/ecommerce/lib/savedForLater'

const line = (over: Partial<SavedLine> = {}): SavedLine => ({ product: 1, variation: null, quantity: 1, title: 'Mug', note: null, ...over })

describe('parseSaved', () => {
  it('returns nothing for bad input', () => {
    expect(parseSaved(null)).toEqual([])
    expect(parseSaved('not json')).toEqual([])
    expect(parseSaved('{"a":1}')).toEqual([])
  })
  it('drops rows without a valid product and fixes quantity', () => {
    const out = parseSaved(JSON.stringify([{ product: 'x' }, { product: 3, quantity: -2, title: 'T' }, { product: 4, quantity: 2 }]))
    expect(out.map((l) => [l.product, l.quantity])).toEqual([[3, 1], [4, 2]])
  })
  it('caps the list', () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ product: i + 1, quantity: 1 }))
    expect(parseSaved(JSON.stringify(rows))).toHaveLength(MAX_SAVED)
  })
})

describe('addSaved and removeSaved', () => {
  it('merges the same product and variation', () => {
    expect(addSaved([line({ quantity: 2 })], line({ quantity: 3 }))).toEqual([line({ quantity: 5 })])
  })
  it('keeps different variations apart, newest first', () => {
    const out = addSaved([line()], line({ variation: 'b' }))
    expect(out.map((l) => l.variation)).toEqual(['b', null])
  })
  it('removes by index', () => {
    expect(removeSaved([line({ product: 1 }), line({ product: 2 })], 0).map((l) => l.product)).toEqual([2])
  })
})

import { mergeSavedLists, readSaved, writeSaved, type D1Saved } from '@/features/ecommerce/server/savedLines'

describe('mergeSavedLists', () => {
  it('keeps the account list and adds browser lines, summing the same product', () => {
    const out = mergeSavedLists([line({ product: 1, quantity: 2 })], [line({ product: 1, quantity: 1 }), line({ product: 2 })])
    expect(out.map((l) => [l.product, l.quantity]).sort()).toEqual([[1, 3], [2, 1]])
  })
  it('caps at the limit', () => {
    const account = Array.from({ length: MAX_SAVED }, (_, i) => line({ product: i + 1 }))
    expect(mergeSavedLists(account, [line({ product: 999 })])).toHaveLength(MAX_SAVED)
  })
})

describe('saved lines store', () => {
  it('writes the list in order and reads it back', async () => {
    const rows: Array<unknown[]> = []
    const d1 = {
      prepare: (sql: string) => ({
        bind: (...v: unknown[]) => ({
          run: async () => {
            if (sql.startsWith('INSERT')) rows.push(v)
            return {}
          },
          all: async () => ({ results: [{ product_id: 3, variation: '', quantity: 2, title: 'Mug', note: null }] }),
        }),
      }),
    }
    const store = d1 as unknown as D1Saved
    await writeSaved(store, 7, [line({ product: 3, quantity: 2, title: 'Mug' })])
    expect(rows[0].slice(0, 5)).toEqual([7, 3, '', 2, 'Mug'])
    expect(await readSaved(store, 7)).toEqual([{ product: 3, variation: null, quantity: 2, title: 'Mug', note: null }])
  })
})
