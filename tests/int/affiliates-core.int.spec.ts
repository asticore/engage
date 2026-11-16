import { describe, expect, it } from 'vitest'

import { chooseCode, cleanPath, looksLikeBot, normaliseCode, parseUtm, readRefCookie, refCookie, referralLink, suggestCode } from '@/features/affiliates/core'

describe('affiliate tracking core', () => {
  it('normalises codes', () => {
    expect(normaliseCode(' Sam-12 ')).toBe('sam-12')
    expect(normaliseCode('a')).toBeNull()
    expect(normaliseCode('-bad')).toBeNull()
    expect(normaliseCode('has space')).toBeNull()
    expect(normaliseCode('x'.repeat(40))).toBeNull()
    expect(normaliseCode(5)).toBeNull()
  })
  it('suggests valid unique-looking codes', () => {
    const code = suggestCode('Sam Smith!', () => 0.5)
    expect(normaliseCode(code)).toBe(code)
    expect(code.startsWith('sam-smith-')).toBe(true)
    expect(normaliseCode(suggestCode('!!!'))).not.toBeNull()
  })
  it('applies first and last click rules', () => {
    expect(chooseCode('old', 'new', 'last')).toBe('new')
    expect(chooseCode('old', 'new', 'first')).toBe('old')
    expect(chooseCode(null, 'new', 'first')).toBe('new')
  })
  it('reads utm, cookie, bots and paths', () => {
    expect(parseUtm(new URLSearchParams('utm_source=news&utm_campaign=x'))).toEqual({ source: 'news', medium: '', campaign: 'x' })
    expect(readRefCookie(`a=1; ${refCookie('sam-12').split(';')[0]}`)).toBe('sam-12')
    expect(readRefCookie('eg_ref=%3Cb%3E')).toBeNull()
    expect(refCookie('sam-12', 30)).toContain('Max-Age=2592000')
    expect(looksLikeBot('Googlebot/2.1')).toBe(true)
    expect(looksLikeBot('')).toBe(true)
    expect(looksLikeBot('Mozilla/5.0 (Macintosh) AppleWebKit Safari')).toBe(false)
    expect(cleanPath('//evil.com')).toBe('/')
    expect(cleanPath('/shop?x=1')).toBe('/shop?x=1')
    expect(referralLink('https://a.com/', 'sam-12')).toBe('https://a.com/?ref=sam-12')
  })
})

import { isToken, newToken } from '@/features/affiliates/core'

describe('affiliate dashboard token', () => {
  it('makes unguessable hex tokens', () => {
    const a = newToken()
    expect(isToken(a)).toBe(true)
    expect(newToken()).not.toBe(a)
    expect(isToken('short')).toBe(false)
    expect(isToken(`${a}x`)).toBe(false)
  })
})

describe('affiliate setup checklist and share kit (31e)', () => {
  it('marks steps done from what exists', async () => {
    const { setupSteps, shareKit } = await import('@/features/affiliates/core')
    const none = setupSteps({ configured: false, affiliates: 0, active: 0, visits: 0, commissions: 0, payouts: 0 })
    expect(none.every((s) => !s.done)).toBe(true)
    const some = setupSteps({ configured: true, affiliates: 2, active: 1, visits: 5, commissions: 0, payouts: 0 })
    expect(some.filter((s) => s.done).map((s) => s.key)).toEqual(['rules', 'first', 'visit'])
    const kit = shareKit({ name: 'Sam', link: 'https://x.com/?ref=sam', dashboard: 'https://x.com/affiliates/dashboard?token=t', commissionPct: 12, cookieDays: 30 })
    expect(kit).toContain('12% commission')
    expect(kit).toContain('https://x.com/?ref=sam')
  })
})

describe('affiliate attribution (31a)', () => {
  it('keeps UTM values in a cookie and reads them back', async () => {
    const { utmCookie, readUtmCookie, normaliseCoupon } = await import('@/features/affiliates/core')
    const cookie = utmCookie({ source: 'news letter', medium: 'email', campaign: 'spring|sale' }).split(';')[0]
    expect(readUtmCookie(`a=b; ${cookie}`)).toEqual({ source: 'news_letter', medium: 'email', campaign: 'spring_sale' })
    expect(readUtmCookie('a=b')).toEqual({ source: '', medium: '', campaign: '' })
    expect(normaliseCoupon(' SAM10 ')).toBe('sam10')
    expect(normaliseCoupon('a')).toBe('')
    expect(normaliseCoupon('bad code!')).toBe('')
  })
  it('allows the cookie only when its consent category is on', async () => {
    const { referralAllowed } = await import('@/features/affiliates/consentGate')
    const rec = (marketing: boolean) => `engage_consent=${encodeURIComponent(JSON.stringify({ v: 1, id: 'abcdefgh1234', c: { necessary: true, preferences: false, analytics: false, marketing }, t: 1 }))}`
    expect(referralAllowed('necessary', null)).toBe(true)
    expect(referralAllowed('marketing', null)).toBe(false)
    expect(referralAllowed('marketing', rec(false))).toBe(false)
    expect(referralAllowed('marketing', rec(true))).toBe(true)
    expect(referralAllowed('analytics', rec(true))).toBe(false)
  })
})

describe('affiliate creatives (26c)', () => {
  it('parses media ids and builds a safe banner snippet', async () => {
    const { parseCreativeIds, bannerSnippet } = await import('@/features/affiliates/core')
    expect(parseCreativeIds('3, 5,3,x,-1,0,7')).toEqual([3, 5, 7])
    expect(parseCreativeIds(undefined)).toEqual([])
    expect(parseCreativeIds(Array.from({ length: 40 }, (_, i) => i + 1).join(','))).toHaveLength(20)
    const html = bannerSnippet({ link: 'https://x.com/?ref=a&b=1', imageUrl: 'https://x.com/i.png', alt: 'A "big" <sale>' })
    expect(html).toContain('href="https://x.com/?ref=a&amp;b=1"')
    expect(html).toContain('alt="A &quot;big&quot; &lt;sale&gt;"')
    expect(html).toContain('rel="sponsored nofollow"')
  })
})
