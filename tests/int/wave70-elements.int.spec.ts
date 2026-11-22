import { describe, expect, it } from 'vitest'

import { ageOn, chatHref, inChatHours, safeDeny } from '@/components/blocks/elements/Wave70Elements'
import { buildSitemap } from '@/components/blocks/elements/Wave70Server'
import { getElementDef } from '@/lib/elements/registry'
import { SITE_ELEMENT_TYPES } from '@/lib/elements/wave38Defs'

const pages: Array<{ id: number; title: string; slug: string; parent: number | null; isHomepage?: boolean }> = [
  { id: 1, title: 'Home', slug: 'home', parent: null, isHomepage: true },
  { id: 2, title: 'About', slug: 'about', parent: null },
  { id: 3, title: 'Team', slug: 'team', parent: 2 },
  { id: 4, title: 'Deep', slug: 'deep', parent: 3 },
  { id: 5, title: 'Secret', slug: 'secret', parent: null },
]

describe('wave70 elements', () => {
  it('registers them', () => {
    expect(getElementDef('sitemap')).toBeTruthy()
    expect(getElementDef('age-gate')).toBeTruthy()
    expect(SITE_ELEMENT_TYPES.has('sitemap')).toBe(true)
    expect(SITE_ELEMENT_TYPES.has('age-gate')).toBe(false)
  })
  it('builds the sitemap tree with depth and exclusions', () => {
    const t = buildSitemap(pages, ['secret'], 2)
    expect(t.map((n) => n.href)).toEqual(['/', '/about'])
    expect(t[1]!.children.map((n) => n.href)).toEqual(['/about/team'])
    expect(t[1]!.children[0]!.children).toEqual([])
    expect(buildSitemap(pages, ['about'], 3).map((n) => n.page.slug)).toEqual(['home', 'secret'])
  })
  it('computes age from a birth date', () => {
    const now = new Date('2026-11-22T00:00:00Z')
    expect(ageOn('2008-11-22', now)).toBe(18)
    expect(ageOn('2008-11-23', now)).toBe(17)
    expect(ageOn('2030-01-01', now)).toBeNull()
    expect(ageOn('2026-02-31', now)).toBeNull()
    expect(ageOn('nope', now)).toBeNull()
  })
  it('accepts only safe deny addresses', () => {
    expect(safeDeny('/sorry')).toBe('/sorry')
    expect(safeDeny('https://example.com/x')).toBe('https://example.com/x')
    expect(safeDeny('//evil.com')).toBe('')
    expect(safeDeny('javascript:alert(1)')).toBe('')
    expect(safeDeny('http://example.com')).toBe('')
  })
  it('builds chat links and checks hours', () => {
    expect(chatHref('whatsapp', '+61 400 000 000', 'Hi there')).toBe('https://wa.me/61400000000?text=Hi%20there')
    expect(chatHref('whatsapp', 'abc', '')).toBe('')
    expect(chatHref('messenger', '@mypage', '')).toBe('https://m.me/mypage')
    expect(chatHref('telegram', 'user_1', '')).toBe('https://t.me/user_1')
    expect(chatHref('telegram', 'a/b', '')).toBe('')
    expect(inChatHours('09:00-17:00', 600)).toBe(true)
    expect(inChatHours('09:00-17:00', 1030)).toBe(false)
    expect(inChatHours('22:00-06:00', 60)).toBe(true)
    expect(inChatHours('', 1000)).toBe(true)
  })
})
