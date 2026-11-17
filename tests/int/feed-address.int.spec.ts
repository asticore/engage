import { describe, expect, it } from 'vitest'

import { feedPathFor, parseFeedAddress } from '@/features/blog/feedAddress'
import { buildRss } from '@/features/blog/rss'

describe('feed addresses', () => {
  it('maps category and tag feed paths', () => {
    expect(parseFeedAddress('/blog/tag/news/feed', 'blog')).toEqual({ query: 'tag', slug: 'news' })
    expect(parseFeedAddress('/blog/category/a/b/feed/', 'blog')).toEqual({ query: 'category', slug: 'b' })
    expect(parseFeedAddress('/journal/category/a/feed', 'journal')).toEqual({ query: 'category', slug: 'a' })
    expect(parseFeedAddress('/blog/news/feed', 'blog')).toBeNull()
    expect(parseFeedAddress('/blog/tag/x/y/feed', 'blog')).toBeNull()
    expect(parseFeedAddress('/other/tag/x/feed', 'blog')).toBeNull()
  })
  it('builds the link for an archive', () => {
    expect(feedPathFor('tag', 'a b', 'blog')).toBe('/blog/tag/a%20b/feed')
  })
  it('puts images and the blog address in feed items', () => {
    const xml = buildRss({ title: 'T', link: 'https://x.test/journal', selfUrl: 'https://x.test/feed.xml', description: 'd', baseUrl: 'https://x.test', mode: 'summary', blogBase: 'journal',
      posts: [{ title: 'P', slug: 'p', date: '2026-01-01', excerpt: 'e', html: '', author: '', categories: [], image: { url: 'https://x.test/a.png', mime: 'image/png' } }] })
    expect(xml).toContain('<link>https://x.test/journal/p</link>')
    expect(xml).toContain('<enclosure url="https://x.test/a.png" length="0" type="image/png"/>')
    expect(xml).toContain('<media:content url="https://x.test/a.png" medium="image"/>')
  })
})
