import { describe, expect, it } from 'vitest'

import { ga4UserId, gtagConfigScript } from '@/features/seo/ga4User'

describe('GA4 user id', () => {
  it('sends nothing without a signed-in user', async () => {
    expect(await ga4UserId(null, { hash: true, secret: 's' })).toBeUndefined()
    expect(await ga4UserId('', { hash: false, secret: '' })).toBeUndefined()
  })
  it('hashes with the site secret, the same way every time, and never shows the account number', async () => {
    const a = await ga4UserId(42, { hash: true, secret: 'secret-one' })
    const b = await ga4UserId(42, { hash: true, secret: 'secret-one' })
    const c = await ga4UserId(42, { hash: true, secret: 'secret-two' })
    expect(a).toMatch(/^[a-f0-9]{32}$/)
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).not.toBe('42')
    expect(await ga4UserId(43, { hash: true, secret: 'secret-one' })).not.toBe(a)
  })
  it('refuses to hash with no secret, and sends the plain ID only when asked', async () => {
    expect(await ga4UserId(42, { hash: true, secret: '' })).toBeUndefined()
    expect(await ga4UserId(42, { hash: false, secret: '' })).toBe('42')
  })
  it('adds user_id to the gtag config and escapes the values', () => {
    expect(gtagConfigScript('G-ABC')).toBe("gtag('config',\"G-ABC\");")
    expect(gtagConfigScript('G-ABC', 'u1')).toBe("gtag('config',\"G-ABC\",{user_id:\"u1\"});")
    expect(gtagConfigScript('G-ABC', '"};alert(1)//')).toContain('{user_id:"\\"};alert(1)//"}')
  })
})
