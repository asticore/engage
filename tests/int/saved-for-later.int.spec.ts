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
