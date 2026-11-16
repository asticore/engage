import { describe, expect, it } from 'vitest'

import { describeAuthMethods } from '@/features/security/authMethods'
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
})
