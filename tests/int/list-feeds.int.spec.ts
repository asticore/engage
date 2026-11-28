// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { eventFeed, productFeed } from '../../src/features/blog/listFeeds'

describe('events and products feeds', () => {
  it('builds an events feed with event links and cover images', () => {
    const xml = eventFeed({ baseUrl: 'https://x.test', selfUrl: 'https://x.test/feed/events.xml', siteName: 'Site', rows: [{ title: 'Gala & party', slug: 'gala', startDate: '2026-12-01T18:00:00Z', summary: 'Join us', coverImage: { url: '/m/a.jpg', mimeType: 'image/jpeg' } }, { title: '', slug: 'skip' }] })
    expect(xml).toContain('<link>https://x.test/events/gala</link>')
    expect(xml).toContain('Gala &amp; party')
    expect(xml).toContain('https://x.test/m/a.jpg')
    expect(xml).not.toContain('skip')
  })
  it('builds a products feed on the shop address', () => {
    const xml = productFeed({ baseUrl: 'https://x.test', selfUrl: 'u', siteName: '', shopBase: 'shop', rows: [{ title: 'Mug', slug: 'mug', createdAt: '2026-11-01T00:00:00Z', shortDescription: 'Blue', images: [{ url: 'https://c.test/mug.png' }] }] })
    expect(xml).toContain('https://x.test/shop/mug')
    expect(xml).toContain('https://c.test/mug.png')
    expect(xml).toContain('<title>New products</title>')
  })
})
