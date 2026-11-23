import { describe, expect, it } from 'vitest'
import { linkPatchFor, rewriteHref, rewriteLinksInValue } from '@/features/redirects/linkRewrite'

const pairs = [{ oldPath: '/about', newPath: '/company' }, { oldPath: '/about/team', newPath: '/company/people' }]

describe('link rewrite', () => {
  it('rewrites the address, below it, with query and fragment, longest first', () => {
    expect(rewriteHref('/about', pairs)).toBe('/company')
    expect(rewriteHref('/about/', pairs)).toBe('/company/')
    expect(rewriteHref('/about?x=1', pairs)).toBe('/company?x=1')
    expect(rewriteHref('/about#top', pairs)).toBe('/company#top')
    expect(rewriteHref('/about/team', pairs)).toBe('/company/people')
    expect(rewriteHref('/about/other', pairs)).toBe('/company/other')
  })
  it('leaves other links alone', () => {
    expect(rewriteHref('/about-us', pairs)).toBeNull()
    expect(rewriteHref('https://x.com/about', pairs)).toBeNull()
    expect(rewriteHref('mailto:a@b.c', pairs)).toBeNull()
    expect(rewriteHref('/', [{ oldPath: '/', newPath: '/home' }])).toBeNull()
  })
  it('changes only link keys, in blocks and rich text', () => {
    const doc = {
      title: 'About',
      slug: 'about',
      blocks: [{ blockType: 'hero', heading: '/about', primaryCtaUrl: '/about' }],
      content: { root: { children: [{ type: 'link', fields: { url: '/about/team' }, children: [{ text: '/about' }] }] } },
      menu: [{ customUrl: '/about', label: '/about' }],
    }
    const change = linkPatchFor(doc, pairs)
    expect(change?.count).toBe(3)
    const blocks = change?.patch.blocks as Array<Record<string, string>>
    expect(blocks[0].primaryCtaUrl).toBe('/company')
    expect(blocks[0].heading).toBe('/about')
    expect(JSON.stringify(change?.patch.content)).toContain('/company/people')
    expect(JSON.stringify(change?.patch.content)).toContain('"text":"/about"')
    expect(change?.patch.title).toBeUndefined()
  })
  it('returns the same value when nothing matches', () => {
    const value = { a: [{ url: '/x' }] }
    expect(rewriteLinksInValue(value, pairs)).toEqual({ value, count: 0 })
  })
})
