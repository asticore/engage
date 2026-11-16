import { describe, expect, it } from 'vitest'

import { describeAuthMethods, togglePatch } from '@/features/security/authMethods'
import { DEFAULT_SECURITY_SETTINGS } from '@/features/security/settings'
import { emptySocialConfig } from '@/features/socialLogin/providers'

describe('authentication overview', () => {
  it('lists every method with defaults', () => {
    const rows = describeAuthMethods(DEFAULT_SECURITY_SETTINGS as never, emptySocialConfig())
    const ids = rows.map((r) => r.id)
    for (const id of ['password', 'magic-link', 'email-code', 'passkeys', 'two-factor', 'social-google', 'social-github']) expect(ids).toContain(id)
    expect(rows.find((r) => r.id === 'password')?.status).toBe('on')
    expect(rows.find((r) => r.id === 'social-google')?.status).toBe('off')
  })
  it('flags a switched-on provider without credentials', () => {
    const social = emptySocialConfig()
    social.providers.google.enabled = true
    const row = describeAuthMethods(DEFAULT_SECURITY_SETTINGS as never, social).find((r) => r.id === 'social-google')!
    expect(row.status).toBe('needs-setup')
    expect(row.detail).toContain('missing')
  })
  it('builds a patch per switchable method and refuses the rest', () => {
    expect(togglePatch('magic-link', true)).toEqual({ magicLinkEnabled: true })
    expect(togglePatch('passkeys', false)).toEqual({ passkeysEnabled: false })
    expect(togglePatch('social-google', true)).toEqual({ socialLogin: { googleEnabled: true } })
    expect(togglePatch('social-nope', true)).toBeNull()
    expect(togglePatch('password', false)).toBeNull()
    expect(togglePatch('two-factor', false)).toBeNull()
  })
  it('marks switchable rows', () => {
    const rows = describeAuthMethods(DEFAULT_SECURITY_SETTINGS as never, emptySocialConfig())
    expect(rows.find((r) => r.id === 'magic-link')?.toggle).toBe(true)
    expect(rows.find((r) => r.id === 'password')?.toggle).toBeUndefined()
  })

  it('shows AI agent access as off, needing setup, or on', () => {
    const row = (info: { featureOn: boolean; apiKeysOn: boolean; activeTokens: number }) =>
      describeAuthMethods(DEFAULT_SECURITY_SETTINGS as never, emptySocialConfig(), info).find((r) => r.id === 'agent-access')!
    expect(row({ featureOn: false, apiKeysOn: true, activeTokens: 0 }).status).toBe('off')
    expect(row({ featureOn: true, apiKeysOn: false, activeTokens: 0 }).status).toBe('needs-setup')
    const on = row({ featureOn: true, apiKeysOn: true, activeTokens: 1 })
    expect(on.status).toBe('on')
    expect(on.detail).toContain('1 active agent token.')
    expect(describeAuthMethods(DEFAULT_SECURITY_SETTINGS as never, emptySocialConfig()).some((r) => r.id === 'agent-access')).toBe(false)
  })

  it('shows single sign-on as off, needing setup, or on', () => {
    const row = (info: { featureOn: boolean; connections: number; enforced: number }) =>
      describeAuthMethods(DEFAULT_SECURITY_SETTINGS as never, emptySocialConfig(), undefined, info).find((r) => r.id === 'org-sso')!
    expect(row({ featureOn: false, connections: 0, enforced: 0 }).status).toBe('off')
    expect(row({ featureOn: true, connections: 0, enforced: 0 }).status).toBe('needs-setup')
    expect(row({ featureOn: true, connections: 2, enforced: 1 }).detail).toBe('2 connections, 1 requiring single sign-on.')
  })
})
