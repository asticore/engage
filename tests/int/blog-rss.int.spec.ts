import { describe, expect, it } from 'vitest'

import { buildRss, lexicalToHtml, type FeedPost } from '@/features/blog/rss'

const post = (over: Partial<FeedPost> = {}): FeedPost => ({ title: 'Tea & cake', slug: 'tea-cake', date: '2026-03-02T10:00:00Z', excerpt: 'A <b>short</b> note', html: '<p>Hi</p>', author: 'Jo', categories: ['News'], ...over })
const feed = (mode: 'summary' | 'full', posts: FeedPost[]) => buildRss({ title: 'Journal', link: 'https://x.test/blog', selfUrl: 'https://x.test/feed.xml', description: 'd', baseUrl: 'https://x.test', mode, posts })

describe('blog RSS', () => {
  it('writes a valid summary feed with escaped text', () => {
    const xml = feed('summary', [post()])
    expect(xml).toContain('<title>Tea &amp; cake</title>')
    expect(xml).toContain('<link>https://x.test/blog/tea-cake</link>')
    expect(xml).toContain('<pubDate>Mon, 02 Mar 2026 10:00:00 GMT</pubDate>')
    expect(xml).toContain('<description><![CDATA[A <b>short</b> note]]></description>')
    expect(xml).not.toContain('content:encoded>')
    expect(xml).toContain('<category>News</category>')
  })
  it('adds the full text only in full mode, and survives a CDATA end marker', () => {
    expect(feed('full', [post()])).toContain('<content:encoded><![CDATA[<p>Hi</p>]]></content:encoded>')
    expect(feed('full', [post({ html: 'a]]>b' })])).toContain('a]]]]><![CDATA[>b')
    expect(feed('full', [post({ html: '' })])).not.toContain('content:encoded>')
  })
  it('drops control characters and caps the item count', () => {
    expect(feed('summary', [post({ title: 'A\u0001B' })])).toContain('<title>AB</title>')
    const many = Array.from({ length: 50 }, (_, i) => post({ slug: `p${i}` }))
    expect(feed('summary', many).match(/<item>/g)).toHaveLength(30)
  })
  it('turns rich text into simple html', () => {
    const doc = { root: { children: [
      { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'Hello' }] },
      { type: 'paragraph', children: [{ type: 'text', text: 'a<b', format: 1 }, { type: 'link', url: 'https://a.test', children: [{ type: 'text', text: 'go' }] }, { type: 'link', url: 'javascript:alert(1)', children: [{ type: 'text', text: 'bad' }] }] },
      { type: 'list', listType: 'bullet', children: [{ type: 'listitem', children: [{ type: 'text', text: 'one' }] }] },
    ] } }
    expect(lexicalToHtml(doc)).toBe('<h2>Hello</h2><p><strong>a&lt;b</strong><a href="https://a.test">go</a>bad</p><ul><li>one</li></ul>')
    expect(lexicalToHtml(null)).toBe('')
  })
})
