import { describe, expect, it } from 'vitest'

import { emptyMatrix, methodAllowed, parseMatrix, setBlocked } from '@/features/security/authMatrix'
import { emptySocialConfig } from '@/features/socialLogin/providers'
import { usableProviders } from '@/features/socialLogin/settings'

describe('who can sign in with what', () => {
  it('allows everything until blocked, and never lists password', () => {
    expect(methodAllowed(emptyMatrix(), 'account', 'magic-link')).toBe(true)
    const m = setBlocked(emptyMatrix(), 'account', 'password', true)
    expect(m.account).toEqual([])
  })
  it('blocks per place and unblocks again', () => {
    let m = setBlocked(emptyMatrix(), 'admin', 'social-apple', true)
    expect(methodAllowed(m, 'admin', 'social-apple')).toBe(false)
    expect(methodAllowed(m, 'account', 'social-apple')).toBe(true)
    m = setBlocked(m, 'admin', 'social-apple', false)
    expect(methodAllowed(m, 'admin', 'social-apple')).toBe(true)
  })
  it('ignores junk when reading', () => {
    expect(parseMatrix('not json')).toEqual(emptyMatrix())
    expect(parseMatrix('{"admin":["nope","passkeys",3],"account":"x"}')).toEqual({ admin: ['passkeys'], account: [] })
  })
  it('hides a blocked provider from that form only', () => {
    const c = emptySocialConfig()
    for (const id of ['google', 'apple'] as const) Object.assign(c.providers[id], { enabled: true, clientId: 'x', clientSecret: 'y', redirectConfirmed: true })
    c.allowAdminSocialLogin = true
    c.providers.apple.teamId = 't'; c.providers.apple.keyId = 'k'; c.providers.apple.privateKey = 'p'
    c.blocked = { admin: ['apple'], account: [] }
    expect(usableProviders(c, 'admin').map((p) => p.id)).toEqual(['google'])
    expect(usableProviders(c, 'account').map((p) => p.id)).toContain('apple')
  })
})
