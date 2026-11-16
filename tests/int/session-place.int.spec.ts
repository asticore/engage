import { describe, expect, it } from 'vitest'

import { withApproxPlace } from '@/features/security/userSessions'

describe('session approximate place', () => {
  it('adds the country name', () => expect(withApproxPlace('Chrome on macOS', 'de')).toBe('Chrome on macOS (near Germany)'))
  it('adds nothing for missing, unknown or Tor codes', () => {
    for (const c of [null, undefined, '', 'XX', 'T1', 'abc', '1']) expect(withApproxPlace('Chrome', c)).toBe('Chrome')
  })
})
