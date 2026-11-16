// The cookie behind the account switcher (23h) and the browser half of the pending token binding (23a1).
import { describe, expect, it } from 'vitest'

import { MAX_OTHER_ACCOUNTS, packOtherSessions, unpackOtherSessions, withToken, withoutToken } from '@/features/accounts/otherSessions'
import { buildPendingBindingCookie, pendingBindingFromCookieHeader } from '@/features/security/pendingBinding'

const SECRET = 'switcher-test-secret'

describe('other sessions cookie', () => {
  it('round trips tokens and keeps their order', () => {
    const packed = packOtherSessions(['a.b.c', 'd.e.f'], SECRET)
    expect(unpackOtherSessions(packed, SECRET)).toEqual(['a.b.c', 'd.e.f'])
  })

  it('rejects an altered, re-signed or unsigned value', () => {
    const packed = packOtherSessions(['a.b.c'], SECRET)
    const [payload, sig] = packed.split('.')
    const forged = Buffer.from(JSON.stringify(['x.y.z'])).toString('base64url')
    expect(unpackOtherSessions(`${forged}.${sig}`, SECRET)).toEqual([])
    expect(unpackOtherSessions(payload, SECRET)).toEqual([])
    expect(unpackOtherSessions(packed, 'another-secret')).toEqual([])
    expect(unpackOtherSessions('', SECRET)).toEqual([])
    expect(unpackOtherSessions(null, SECRET)).toEqual([])
  })

  it('holds nothing without a signing secret', () => {
    expect(packOtherSessions(['a.b.c'], '')).toBe('')
    expect(unpackOtherSessions('anything.here', '')).toEqual([])
  })

  it('keeps at most four, newest first, and no duplicates', () => {
    let list: string[] = []
    for (const t of ['t1', 't2', 't3', 't4', 't5']) list = withToken(list, t)
    expect(list).toEqual(['t5', 't4', 't3', 't2'])
    expect(list).toHaveLength(MAX_OTHER_ACCOUNTS)
    expect(withToken(list, 't3')).toEqual(['t3', 't5', 't4', 't2'])
    expect(unpackOtherSessions(packOtherSessions(['a', 'b', 'c', 'd', 'e', 'f'], SECRET), SECRET)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('removes only the named token', () => {
    expect(withoutToken(['a', 'b', 'c'], 'b')).toEqual(['a', 'c'])
  })
})

describe('pending binding cookie', () => {
  it('reads the value back out of a Cookie header', () => {
    expect(pendingBindingFromCookieHeader('a=1; eg_pending_bind=abc123; b=2')).toBe('abc123')
    expect(pendingBindingFromCookieHeader('a=1')).toBeNull()
    expect(pendingBindingFromCookieHeader(null)).toBeNull()
  })

  it('is HttpOnly and lax', () => {
    const line = buildPendingBindingCookie('abc', true)
    expect(line).toContain('HttpOnly')
    expect(line).toContain('SameSite=Lax')
    expect(line).toContain('Secure')
  })
})
