// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { firstLoginPending, firstLoginRedirect } from '@/features/security/firstLoginGate'

const base = { profilePath: '/other/users/1', twoFactorPath: '/security/two-factor' }

describe('first login order', () => {
  it('sends the start user to the profile first, even when two-step is also required', () => {
    const input = { ...base, profileChangeDue: true, twoFactorMustEnrol: true }
    expect(firstLoginRedirect({ ...input, pathname: '/' })).toBe('profile')
    expect(firstLoginRedirect({ ...input, pathname: '/security/two-factor' })).toBe('profile')
  })

  it('leaves the profile alone so the two guards cannot loop', () => {
    const input = { ...base, profileChangeDue: true, twoFactorMustEnrol: true }
    expect(firstLoginRedirect({ ...input, pathname: '/other/users/1' })).toBeNull()
  })

  it('moves to two-step once the profile is changed, and stays there', () => {
    const input = { ...base, profileChangeDue: false, twoFactorMustEnrol: true }
    expect(firstLoginRedirect({ ...input, pathname: '/other/users/1' })).toBe('twoFactor')
    expect(firstLoginRedirect({ ...input, pathname: '/security/two-factor' })).toBeNull()
  })

  it('never ping-pongs for any path', () => {
    for (const profileChangeDue of [true, false])
      for (const twoFactorMustEnrol of [true, false])
        for (const pathname of ['/', '/other/users/1', '/security/two-factor']) {
          const first = firstLoginRedirect({ ...base, profileChangeDue, twoFactorMustEnrol, pathname })
          if (!first) continue
          const landed = first === 'profile' ? base.profilePath : base.twoFactorPath
          expect(firstLoginRedirect({ ...base, profileChangeDue, twoFactorMustEnrol, pathname: landed })).toBeNull()
        }
  })

  it('holds the tour and questions until both steps are done', () => {
    expect(firstLoginPending({ profileChangeDue: true, twoFactorMustEnrol: false })).toBe(true)
    expect(firstLoginPending({ profileChangeDue: false, twoFactorMustEnrol: true })).toBe(true)
    expect(firstLoginPending({ profileChangeDue: false, twoFactorMustEnrol: false })).toBe(false)
  })
})
