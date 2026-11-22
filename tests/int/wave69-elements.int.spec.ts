import { describe, expect, it } from 'vitest'

import { stockState } from '@/components/blocks/elements/Wave69Server'
import { getElementDef } from '@/lib/elements/registry'
import { SITE_ELEMENT_TYPES } from '@/lib/elements/wave38Defs'
import { productBlockContext } from '@/lib/blockContextFrom'

describe('wave69 product widgets', () => {
  it('registers them as site elements', () => {
    for (const t of ['product-images', 'product-stock', 'product-short-description', 'product-meta']) {
      expect(getElementDef(t)).toBeTruthy()
      expect(SITE_ELEMENT_TYPES.has(t)).toBe(true)
    }
  })
  it('works out the stock state', () => {
    expect(stockState(undefined, 5).kind).toBe('in')
    expect(stockState(null, 5).kind).toBe('in')
    expect(stockState(20, 5).kind).toBe('in')
    expect(stockState(3, 5)).toEqual({ kind: 'low', count: 3 })
    expect(stockState(0, 5, 'no').kind).toBe('out')
    expect(stockState(0, 5, 'notify').kind).toBe('backorder')
  })
  it('puts product facts in the block context', () => {
    const c = productBlockContext({ id: 1, title: 'T', sku: 'A-1', gtin: '123', shortDescription: 'Short', category: 'Shoes', images: [{ url: '/a.jpg', alt: 'A' }, { url: '', alt: '' }] }, '/shop/t')
    expect(c.product?.sku).toBe('A-1')
    expect(c.product?.images).toEqual([{ url: '/a.jpg', alt: 'A' }])
    expect(c.product?.shortDescription).toBe('Short')
  })
})
