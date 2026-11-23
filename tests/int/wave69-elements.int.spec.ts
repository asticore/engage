import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// React's cache() only memoises inside a server request; stand in a per-process memoiser so setBlockContext sticks.
vi.mock('react', async (orig) => {
  const actual = await orig<typeof import('react')>()
  return { ...actual, cache: <T extends () => unknown>(fn: T) => { let v: ReturnType<T>; let done = false; return () => (done ? v : ((done = true), (v = fn() as ReturnType<T>))) } }
})

import { ProductGallery } from '@/components/blocks/elements/Wave69Elements'
import { ProductMetaElement, stockState, tabsFor } from '@/components/blocks/elements/Wave69Server'
import { imageForSelection, orderGallery } from '@/features/ecommerce/lib/variationImage'
import { setBlockContext } from '@/lib/blockContext'
import { getElementDef } from '@/lib/elements/registry'
import { SITE_ELEMENT_TYPES } from '@/lib/elements/wave38Defs'
import { productBlockContext } from '@/lib/blockContextFrom'

const render = (node: React.ReactNode) => renderToStaticMarkup(React.createElement(React.Fragment, null, node))

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
  it('picks the tabs that have content', () => {
    const on = { description: true, info: true, reviews: true }
    expect(tabsFor({}, on)).toEqual([])
    expect(tabsFor({ description: {}, sku: 'A', ratingCount: 2 }, on)).toEqual(['description', 'info', 'reviews'])
    expect(tabsFor({ description: {}, sku: 'A' }, { ...on, info: false })).toEqual(['description'])
  })
  it('adds weight and size to the context', () => {
    const c = productBlockContext({ id: 1, title: 'T', weight: 2, length: 10, width: 5, height: 3, description: { root: {} } }, '/shop/t')
    expect(c.product?.dimensions).toBe('10 x 5 x 3')
    expect(c.product?.weight).toBe(2)
    expect(c.product?.description).toEqual({ root: {} })
  })
  it('reads the brand and tag names from the product', () => {
    const c = productBlockContext({ id: 1, title: 'T', brand: { id: 3, name: 'Acme' }, tags: [{ id: 1, name: 'Sale' }, 7, { id: 2, name: 'New' }] }, '/shop/t')
    expect(c.product?.brand).toBe('Acme')
    expect(c.product?.tags).toEqual(['Sale', 'New'])
  })
  it('leaves out brand and tags that are not populated or missing', () => {
    const c = productBlockContext({ id: 1, title: 'T', brand: 4, tags: null }, '/shop/t')
    expect(c.product?.brand).toBeUndefined()
    expect(c.product?.tags).toEqual([])
  })
  it('shows brand and tags in product meta only when switched on and the product has them', async () => {
    setBlockContext({ product: { id: 1, sku: 'A-1', brand: 'Acme', tags: ['Sale', 'New'] } })
    const off = render(await ProductMetaElement({}))
    expect(off).toContain('A-1')
    expect(off).not.toContain('Brand')
    expect(off).not.toContain('Tags')
    const on = render(await ProductMetaElement({ showBrand: true, showTags: true }))
    expect(on).toContain('<dt>Brand</dt><dd>Acme</dd>')
    expect(on).toContain('<dt>Tags</dt><dd>Sale, New</dd>')
    setBlockContext({ product: { id: 1, sku: 'A-1' } })
    const none = render(await ProductMetaElement({ showBrand: true, showTags: true }))
    expect(none).toContain('A-1')
    expect(none).not.toContain('Brand')
    expect(none).not.toContain('Tags')
  })
  it('shows the chosen variation picture first in the gallery', () => {
    const images = [{ url: '/a.jpg', alt: 'A' }, { url: '/b.jpg', alt: 'B' }]
    const variations = [{ imageUrl: '/b.jpg', attributes: { Colour: 'Red' } }]
    const options = [{ name: 'Colour' }]
    expect(orderGallery(images, imageForSelection(variations, options, { Colour: 'red' })).map((img) => img.url)).toEqual(['/b.jpg', '/a.jpg'])
    expect(orderGallery(images, imageForSelection(variations, options, {})).map((img) => img.url)).toEqual(['/a.jpg', '/b.jpg'])
  })
  it('renders the gallery starting on the first picture with thumbnails', () => {
    const images = [{ url: '/a.jpg', alt: 'A' }, { url: '/b.jpg', alt: 'B' }]
    const html = render(React.createElement(ProductGallery, { images, thumbnails: true, zoom: false }))
    expect(html).toContain('<img src="/a.jpg" alt="A"')
    expect(html.match(/<button /g)).toHaveLength(2)
    expect(html).toContain('aria-current="true"')
  })
})
