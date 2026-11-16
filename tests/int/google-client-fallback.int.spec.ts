import { describe, expect, it, vi } from 'vitest'

vi.mock('@/features/security/authMatrix', () => ({ readMatrix: async () => ({ admin: [], account: [] }) }))

import { resolveGoogleClient } from '@/features/google/auth'

const engine = (social: Record<string, unknown>) => ({ findGlobal: async () => social }) as never

describe('Google client reuse', () => {
  it('keeps the connection client when both fields are set', async () => {
    const r = await resolveGoogleClient(engine({}), { clientId: 'own', clientSecretEnc: 'sec' })
    expect(r).toEqual({ clientId: 'own', clientSecret: 'sec' })
  })
  it('falls back to the Google sign-in client when the connection has none', async () => {
    const r = await resolveGoogleClient(engine({ socialLogin: { googleClientId: 'shared', googleClientSecret: 'shh' } }), null)
    expect(r).toEqual({ clientId: 'shared', clientSecret: 'shh' })
  })
  it('returns empty when neither is set', async () => {
    expect(await resolveGoogleClient(engine({}), null)).toEqual({ clientId: '', clientSecret: '' })
  })
})
