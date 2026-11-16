import { describe, expect, it } from 'vitest'

import { decideCountry, decideIp, matches, parseBulk, parseCountries, parseEntry, parseIp, type IpRule } from '@/features/security/ipRules'

const rule = (kind: IpRule['kind'], entry: string, expiresAt: string | null = null): IpRule => ({ id: 1, kind, entry, reason: '', expiresAt, createdAt: '' })

describe('ip rules', () => {
  it('parses addresses', () => {
    expect(parseIp('203.0.113.7')).not.toBeNull()
    expect(parseIp('256.1.1.1')).toBeNull()
    expect(parseIp('2001:db8::1')).not.toBeNull()
    expect(parseIp('::1')).not.toBeNull()
    expect(parseIp('not an ip')).toBeNull()
    expect(parseEntry('10.0.0.0/33')).toBeNull()
    expect(parseEntry('10.0.0.0/8')).not.toBeNull()
    expect(parseEntry('2001:db8::/32')).not.toBeNull()
    expect(parseEntry('1.2.3.4/5/6')).toBeNull()
  })
  it('matches single addresses and ranges', () => {
    expect(matches('203.0.113.7', '203.0.113.7')).toBe(true)
    expect(matches('203.0.113.8', '203.0.113.7')).toBe(false)
    expect(matches('203.0.113.200', '203.0.113.0/24')).toBe(true)
    expect(matches('203.0.114.1', '203.0.113.0/24')).toBe(false)
    expect(matches('2001:db8::5', '2001:db8::/32')).toBe(true)
    expect(matches('2001:db9::5', '2001:db8::/32')).toBe(false)
    expect(matches('1.2.3.4', '2001:db8::/32')).toBe(false)
  })
  it('lets the allow list win and respects expiry', () => {
    const now = Date.parse('2026-06-01T00:00:00Z')
    expect(decideIp('1.2.3.4', [rule('block', '1.2.3.0/24')], now)).toBe('block')
    expect(decideIp('1.2.3.4', [rule('block', '1.2.3.0/24'), rule('allow', '1.2.3.4')], now)).toBe('allow')
    expect(decideIp('1.2.3.4', [rule('block', '1.2.3.0/24', '2026-01-01T00:00:00Z')], now)).toBe('none')
    expect(decideIp('9.9.9.9', [rule('block', '1.2.3.0/24')], now)).toBe('none')
    expect(decideIp('unknown', [rule('block', '1.2.3.0/24')], now)).toBe('none')
  })
  it('parses a pasted list', () => {
    const r = parseBulk('1.2.3.4\n5.6.7.0/24, bad entry # note\n# whole comment\n1.2.3.4')
    expect(r.entries).toEqual(['1.2.3.4', '5.6.7.0/24'])
    expect(r.rejected).toEqual(['bad entry'])
  })
  it('applies country rules from the header', () => {
    const block = [rule('country-block', 'CN'), rule('country-block', 'XX')]
    expect(decideCountry('CN', block)).toBe('block')
    expect(decideCountry('cn', block)).toBe('block')
    expect(decideCountry('AU', block)).toBe('allow')
    expect(decideCountry(null, block)).toBe('block')
    expect(decideCountry('T1', block)).toBe('block')
    const only = [rule('country-allow', 'AU'), rule('country-allow', 'NZ')]
    expect(decideCountry('AU', only)).toBe('allow')
    expect(decideCountry('US', only)).toBe('block')
    expect(decideCountry(null, only)).toBe('block')
    expect(decideCountry('US', [])).toBe('allow')
    expect(parseCountries('au, nz xx bad1 AU').codes).toEqual(['AU', 'NZ', 'XX'])
    expect(parseCountries('bad1').rejected).toEqual(['bad1'])
  })
})
