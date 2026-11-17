import { describe, expect, it } from 'vitest'

import { BAN_FOREVER, BAN_MARKER, banLockUntil, isBanned } from '@/features/security/userBans'

describe('user bans', () => {
  const now = Date.parse('2026-06-01T00:00:00Z')
  it('works out the lock date', () => {
    expect(banLockUntil(null, now)).toBe(BAN_FOREVER)
    expect(banLockUntil(0, now)).toBe(BAN_FOREVER)
    expect(banLockUntil(7, now)).toBe('2026-06-08T00:00:00.000Z')
    expect(banLockUntil(99999, now).startsWith('2036')).toBe(true)
  })
  it('tells a ban from an ordinary lockout and lifts on expiry', () => {
    expect(isBanned({ lockUntil: BAN_FOREVER, loginAttempts: BAN_MARKER }, now)).toBe(true)
    expect(isBanned({ lockUntil: BAN_FOREVER, loginAttempts: 5 }, now)).toBe(false)
    expect(isBanned({ lockUntil: '2026-05-01T00:00:00.000Z', loginAttempts: BAN_MARKER }, now)).toBe(false)
    expect(isBanned({ lockUntil: null, loginAttempts: BAN_MARKER }, now)).toBe(false)
  })
})
