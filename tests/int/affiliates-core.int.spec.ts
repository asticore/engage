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
