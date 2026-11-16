import { describe, expect, it } from 'vitest'

import { cleanSource, outboundHref, sourceOf } from '@/features/ecommerce/outboundShared'

describe('outbound links (Task 31d)', () => {
  it('cloaks to /go/<id> and keeps the real address when id is missing', () => {
    expect(outboundHref(7, 'https://x.test/a', true)).toBe('/go/7?s=product')
    expect(outboundHref(7, 'https://x.test/a', false)).toBe('https://x.test/a')
    expect(outboundHref(undefined, 'https://x.test/a', true)).toBe('https://x.test/a')
  })
  it('cleans sources', () => {
    expect(cleanSource('<b>Shop/Page</b>')).toBe('b-shop/page-/b')
    expect(cleanSource('')).toBe('direct')
    expect(sourceOf(null, 'https://a.test/blog/post', 'a.test')).toBe('/blog/post')
    expect(sourceOf(null, 'https://other.test/x', 'a.test')).toBe('direct')
  })
})
