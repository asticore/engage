import { describe, expect, it } from 'vitest'

import { mappedFields, parseMapping, parseRefreshMinutes, renderTemplate } from '@/features/ecommerce/lib/feedMapping'
import { parseFeedInput } from '@/features/ecommerce/lib/feedRecords'
import { buildFeedItems } from '@/features/ecommerce/lib/feeds'

const product = { id: 1, slug: 'tee', title: 'Tee', sku: 'T-1', priceInAUD: 20, category: 'shirts', brandName: 'Acme', meta: { size: 'M' }, productType: 'simple', images: [{ url: '/a.jpg' }], manageStock: false }
const ctx = { baseUrl: 'https://shop.test', currency: 'AUD', brand: 'Shop' }

describe('product feed field mapping', () => {
  it('fills placeholders from the product and keeps plain text', () => {
    expect(renderTemplate('{brandName} {title}', product)).toBe('Acme Tee')
    expect(renderTemplate('Fixed brand', product)).toBe('Fixed brand')
    expect(renderTemplate('{meta.size}', product)).toBe('M')
    expect(renderTemplate('{missing}', product)).toBe('')
    expect(renderTemplate('{__proto__.x}', product)).toBe('')
  })
  it('keeps only known columns and ignores blanks', () => {
    expect(parseMapping({ brand: ' {brandName} ', nope: 'x', gtin: '  ' })).toEqual({ brand: '{brandName}' })
    expect(parseMapping('not json')).toEqual({})
    expect(parseMapping('{"mpn":"{sku}"}')).toEqual({ mpn: '{sku}' })
  })
  it('ignores a bad condition and a blank result', () => {
    expect(mappedFields(product, { condition: 'broken' })).toEqual({})
    expect(mappedFields(product, { condition: 'Used', brand: '{missing}' })).toEqual({ condition: 'used' })
  })
  it('overrides built-in values in the rows', () => {
    const items = buildFeedItems([product], { ...ctx, map: (p) => mappedFields(p, { brand: '{brandName}', title: 'Mapped {title}' }) })
    expect(items[0]).toMatchObject({ brand: 'Acme', title: 'Mapped Tee' })
    expect(buildFeedItems([product], ctx)[0]).toMatchObject({ brand: 'Shop', title: 'Tee' })
  })
  it('keeps the variation label on a mapped title', () => {
    const variable = { ...product, productType: 'variable', variations: [{ id: 'v1', enabled: true, sku: 'T-1-M', priceInAUD: 20, attributeValues: 'Size=M' }] }
    const items = buildFeedItems([variable], { ...ctx, map: (p) => mappedFields(p, { title: 'Mapped {title}' }) })
    expect(items.length).toBeGreaterThan(0)
    expect(items[0].title.startsWith('Mapped Tee')).toBe(true)
  })
  it('validates the refresh interval and saves mapping through feed input', () => {
    expect(parseRefreshMinutes(15)).toBe(15)
    expect(parseRefreshMinutes(7)).toBe(60)
    const ok = parseFeedInput({ name: 'x', channel: 'google', mapping: { brand: '{brandName}' }, refreshMinutes: 360 })
    expect(ok.ok && ok.feed).toMatchObject({ mapping: { brand: '{brandName}' }, refreshMinutes: 360 })
  })
})
