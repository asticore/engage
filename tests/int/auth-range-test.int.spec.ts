import { describe, expect, it } from 'vitest'

import { checkProviderConfig, testKind } from '@/features/security/authMethodTest'
import { parseSignInRange } from '@/features/security/authRange'
import { emptyProviderConfig } from '@/features/socialLogin/providers'

const now = new Date('2026-11-16T12:00:00Z')

describe('sign-in date range', () => {
  it('defaults to the last 30 days', () => {
    const r = parseSignInRange(undefined, undefined, now)
    expect(r).toMatchObject({ from: '2026-10-18', to: '2026-11-16', days: 30, custom: false })
  })
  it('accepts a custom range, swaps reversed dates, clamps the future and the length', () => {
    expect(parseSignInRange('2026-11-01', '2026-11-07', now)).toMatchObject({ days: 7, custom: true })
    expect(parseSignInRange('2026-11-07', '2026-11-01', now).from).toBe('2026-11-01')
    expect(parseSignInRange('2026-11-10', '2027-01-01', now).to).toBe('2026-11-16')
    expect(parseSignInRange('2020-01-01', '2026-11-16', now).days).toBe(365)
    expect(parseSignInRange('junk', 'x', now).custom).toBe(false)
  })
})

describe('auth method test', () => {
  it('classifies methods', () => {
    expect(testKind('magic-link')).toBe('email')
    expect(testKind('social-google')).toBe('provider')
    expect(testKind('passkeys')).toBeNull()
  })
  it('checks provider credentials', () => {
    expect(checkProviderConfig('google', emptyProviderConfig()).ok).toBe(false)
    const ok = checkProviderConfig('google', { ...emptyProviderConfig(), enabled: true, clientId: 'a', clientSecret: 'b' })
    expect(ok.ok).toBe(true)
  })
})

describe('auth method test messages are translated', () => {
  it('uses the translator for provider checks', () => {
    const tr = (key: string, vars?: Record<string, string | number>) => `${key}|${JSON.stringify(vars ?? {})}`
    const miss = checkProviderConfig('google', emptyProviderConfig(), tr as never)
    expect(miss.message.startsWith('auth.msg.providerMissing|')).toBe(true)
    const off = checkProviderConfig('google', { ...emptyProviderConfig(), enabled: false, clientId: 'a', clientSecret: 'b' }, tr as never)
    expect(off.message.startsWith('auth.msg.providerOff|')).toBe(true)
  })
})
