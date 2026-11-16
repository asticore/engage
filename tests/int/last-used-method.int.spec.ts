import { describe, expect, it } from 'vitest'

import { cleanMethod, lastMethodCookie, methodFor, readLastMethod } from '@/features/accounts/lastUsed'

describe('last used sign-in method', () => {
  it('reads and writes the cookie', () => {
    expect(readLastMethod('a=1; eg_last_method=google; b=2')).toBe('google')
    expect(readLastMethod('a=1')).toBeNull()
    expect(lastMethodCookie('github')).toContain('eg_last_method=github')
  })
  it('ignores odd values', () => {
    expect(cleanMethod('<script>')).toBeNull()
    expect(cleanMethod('x'.repeat(40))).toBeNull()
    expect(readLastMethod('eg_last_method=%3Cb%3E')).toBeNull()
  })
  it('maps clicks to methods', () => {
    expect(methodFor({ socialClass: 'btn account-social__button account-social__button--apple' })).toBe('apple')
    expect(methodFor({ formHasPassword: true })).toBe('password')
    expect(methodFor({ formHasPassword: false })).toBeNull()
  })
})

describe('last used: emailed and passkey methods', () => {
  it('maps buttons to methods', async () => {
    const { methodForButton, selectorForMethod } = await import('@/features/accounts/lastUsed')
    expect(methodForButton({ kind: 'link' })).toBe('magic-link')
    expect(methodForButton({ kind: 'code' })).toBe('email-code')
    expect(methodForButton({ inPasskeyBox: true })).toBe('passkey')
    expect(methodForButton({ kind: 'other' })).toBeNull()
    expect(selectorForMethod('passkey')).toBe('.account-passkey button')
    expect(selectorForMethod('google')).toBe('.account-social__button--google')
    expect(selectorForMethod('<b>')).toBeNull()
  })
})
