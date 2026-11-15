import { describe, expect, it } from 'vitest'

import { feedPath, matchesFeedFilters, parseFeedInput, pinterestCsv, renderFeed, tokenFromSegment, validateFeed } from '@/features/ecommerce/lib/feedRecords'
import { buildFeedItems } from '@/features/ecommerce/lib/feeds'

const products = [
  { id: 1, slug: 'tee', title: 'Tee', priceInAUD: 20, category: 'shirts', tags: [{ slug: 'sale' }], productType: 'simple', images: [{ url: '/a.jpg' }], manageStock: false },
  { id: 2, slug: 'mug', title: 'Mug', priceInAUD: 10, category: 'kitchen', tags: [], productType: 'simple', images: [{ url: '/b.jpg' }], manageStock: false },
]
const ctx = { baseUrl: 'https://shop.test', currency: 'AUD', brand: 'Shop' }

describe('product feed records', () => {
  it('validates input', () => {
    expect(parseFeedInput(null).ok).toBe(false)
    expect(parseFeedInput({ name: '', channel: 'google' }).ok).toBe(false)
    expect(parseFeedInput({ name: 'x', channel: 'tiktok' }).ok).toBe(false)
    expect(parseFeedInput({ name: 'x', channel: 'meta', currency: 'dollars' }).ok).toBe(false)
    const ok = parseFeedInput({ name: ' Pins ', channel: 'pinterest', currency: 'usd', category: 'Shirts' })
    expect(ok.ok && ok.feed).toMatchObject({ name: 'Pins', currency: 'USD', category: 'shirts', enabled: true, includeOutOfStock: false })
  })
  it('builds addresses and reads them back', () => {
    const token = 'a'.repeat(32)
    expect(feedPath({ token, channel: 'google' })).toBe(`/feeds/custom/${token}.xml`)
    expect(feedPath({ token, channel: 'pinterest' })).toBe(`/feeds/custom/${token}.csv`)
    expect(tokenFromSegment(`${token}.xml`)).toBe(token)
    expect(tokenFromSegment('short.xml')).toBeNull()
    expect(tokenFromSegment(`${token}.json`)).toBeNull()
  })
  it('filters by category and tag slug', () => {
    expect(matchesFeedFilters(products[0], { category: 'shirts', tag: '' })).toBe(true)
    expect(matchesFeedFilters(products[1], { category: 'shirts', tag: '' })).toBe(false)
    expect(matchesFeedFilters(products[0], { category: '', tag: 'sale' })).toBe(true)
    expect(matchesFeedFilters(products[1], { category: '', tag: 'sale' })).toBe(false)
    expect(matchesFeedFilters(products[1], { category: '', tag: '' })).toBe(true)
  })
  it('applies the price hook to price and sale price', () => {
    const items = buildFeedItems(products, { ...ctx, currency: 'USD', price: (_p, _v, regular, current) => ({ regular: regular / 2, current: current / 4 }) })
    expect(items[0].price).toBe('10.00 USD')
    expect(items[0].salePrice).toBe('5.00 USD')
  })
  it('renders each channel with the right content type', () => {
    const items = buildFeedItems(products, ctx)
    expect(renderFeed('google', items, { title: 'S', link: 'https://shop.test' }).contentType).toContain('xml')
    const pin = renderFeed('pinterest', items, { title: 'S', link: 'https://shop.test' })
    expect(pin.contentType).toContain('csv')
    expect(pin.body.split('\r\n')[0]).toContain('image_link')
    expect(pinterestCsv(items).split('\r\n').length).toBe(4)
  })
  it('reports what a channel would reject', () => {
    const items = buildFeedItems(products, ctx)
    expect(validateFeed('csv', items)).toEqual([])
    const missing = validateFeed('meta', items)
    expect(missing.some((p) => p.message.includes('brand')) || missing.length === 0).toBe(true)
    expect(validateFeed('google', [items[0], items[0]]).some((p) => p.message.includes('more than one'))).toBe(true)
  })
})
