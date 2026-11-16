import { describe, expect, it } from 'vitest'

import { placeHasWayIn } from '@/features/security/authMethods'
import { DEFAULT_SECURITY_SETTINGS } from '@/features/security/settings'
import { blockedMessage, socialMessage } from '@/features/socialLogin/messages'
import { emptyMatrix, methodAllowed, parseMatrix, setBlocked } from '@/features/security/authMatrix'
import { emptySocialConfig } from '@/features/socialLogin/providers'
import { usableProviders } from '@/features/socialLogin/settings'

describe('who can sign in with what', () => {
  it('allows everything until blocked', () => {
    expect(methodAllowed(emptyMatrix(), 'account', 'magic-link')).toBe(true)
    expect(methodAllowed(emptyMatrix(), 'members', 'password')).toBe(true)
  })
  it('blocks the password per place, but never on the admin sign-in', () => {
    const m = setBlocked(emptyMatrix(), 'members', 'password', true)
    expect(methodAllowed(m, 'members', 'password')).toBe(false)
    expect(methodAllowed(m, 'account', 'password')).toBe(true)
    const admin = setBlocked(emptyMatrix(), 'admin', 'password', true)
    expect(admin.admin).toEqual([])
    expect(setBlocked(m, 'members', 'password', false).members).toEqual([])
  })
  it('keeps customers and members apart', () => {
    const m = setBlocked(emptyMatrix(), 'members', 'social-apple', true)
    expect(methodAllowed(m, 'members', 'social-apple')).toBe(false)
    expect(methodAllowed(m, 'account', 'social-apple')).toBe(true)
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
    expect(parseMatrix('{"admin":["nope","passkeys",3],"account":"x"}')).toEqual({ admin: ['passkeys'], account: [], members: [] })
  })
  it('hides a blocked provider from that form only', () => {
    const c = emptySocialConfig()
    for (const id of ['google', 'apple'] as const) Object.assign(c.providers[id], { enabled: true, clientId: 'x', clientSecret: 'y', redirectConfirmed: true })
    c.allowAdminSocialLogin = true
    c.providers.apple.teamId = 't'; c.providers.apple.keyId = 'k'; c.providers.apple.privateKey = 'p'
    c.blocked = { admin: ['apple'], account: [], members: ['google'] }
    expect(usableProviders(c, 'admin').map((p) => p.id)).toEqual(['google'])
    expect(usableProviders(c, 'account').map((p) => p.id)).toContain('apple')
    expect(usableProviders(c, 'members').map((p) => p.id)).toEqual(['apple'])
  })
})

describe('never a place with no way in', () => {
  const base = DEFAULT_SECURITY_SETTINGS as never
  it('keeps the password open while it is the only way', () => {
    const m = setBlocked(emptyMatrix(), 'members', 'password', true)
    expect(placeHasWayIn('members', m, base, emptySocialConfig())).toBe(false)
  })
  it('allows blocking it once another method is on and allowed for that place', () => {
    const settings = { ...DEFAULT_SECURITY_SETTINGS, passwordless: { ...DEFAULT_SECURITY_SETTINGS.passwordless, magicLinkEnabled: true } } as never
    let m = setBlocked(emptyMatrix(), 'members', 'password', true)
    expect(placeHasWayIn('members', m, settings, emptySocialConfig())).toBe(true)
    m = setBlocked(m, 'members', 'magic-link', true)
    expect(placeHasWayIn('members', m, settings, emptySocialConfig())).toBe(false)
    expect(placeHasWayIn('account', m, settings, emptySocialConfig())).toBe(true)
  })
})

describe('refusal that names the method', () => {
  it('names the provider for a blocked social start', () => {
    expect(blockedMessage('blocked-google')).toBe('Signing in with Google is not turned on here. Use another way to sign in.')
    expect(socialMessage('blocked-apple')).toContain('Apple')
  })
  it('echoes only known provider ids', () => {
    expect(blockedMessage('blocked-<script>')).toBeNull()
    expect(socialMessage('blocked-nope')).toBe(socialMessage('not-found'))
  })
})
