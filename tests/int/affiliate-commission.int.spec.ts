import { describe, expect, it } from 'vitest'

import { afterRefund, balances, clampDays, clampPct, commissionBase, commissionCents, effectiveRate, eligibleAt, isSelfReferral, meetsMinimum, payoutsCsv } from '@/features/affiliates/commission'

describe('affiliate commission maths', () => {
  it('works on subtotal minus discount', () => {
    expect(commissionBase(10000, 2500)).toBe(7500)
    expect(commissionBase(1000, 5000)).toBe(0)
    expect(commissionBase(undefined, undefined)).toBe(0)
    expect(commissionCents(7500, 10)).toBe(750)
    expect(commissionCents(333, 10)).toBe(33)
  })
  it('reduces in proportion to refunds', () => {
    expect(afterRefund(10000, 10, 0, 12000)).toBe(1000)
    expect(afterRefund(10000, 10, 6000, 12000)).toBe(500)
    expect(afterRefund(10000, 10, 12000, 12000)).toBe(0)
    expect(afterRefund(10000, 10, 20000, 12000)).toBe(0)
    expect(afterRefund(10000, 10, 100, 0)).toBe(0)
  })
  it('clamps settings and blocks self referral', () => {
    expect(clampPct(150)).toBe(10)
    expect(clampPct('12.345')).toBe(12.35)
    expect(clampDays(-1, 30)).toBe(30)
    expect(clampDays(7, 30)).toBe(7)
    expect(isSelfReferral(' Sam@X.com ', 'sam@x.com')).toBe(true)
    expect(isSelfReferral('', '')).toBe(false)
    expect(isSelfReferral('a@x.com', 'b@x.com')).toBe(false)
  })
  it('splits balances into waiting, owed and paid', () => {
    const now = new Date('2026-11-16T00:00:00Z')
    const b = balances(
      [
        { status: 'pending', amount_cents: 500, eligible_at: eligibleAt(now, 10) },
        { status: 'pending', amount_cents: 700, eligible_at: '2026-11-01T00:00:00.000Z' },
        { status: 'paid', amount_cents: 900, eligible_at: null },
        { status: 'reversed', amount_cents: 0, eligible_at: null },
      ],
      now,
    )
    expect(b).toEqual({ pending: 500, owed: 700, paid: 900 })
  })
})

describe('affiliate rules (31b)', () => {
  it('uses the affiliate override when set', () => {
    expect(effectiveRate(null, 10)).toBe(10)
    expect(effectiveRate(undefined, 10)).toBe(10)
    expect(effectiveRate(25, 10)).toBe(25)
    expect(effectiveRate(0, 10)).toBe(0)
    expect(effectiveRate(500, 10)).toBe(10)
  })
  it('holds a payout back below the minimum', () => {
    expect(meetsMinimum(0, 0)).toBe(false)
    expect(meetsMinimum(500, 0)).toBe(true)
    expect(meetsMinimum(499, 500)).toBe(false)
    expect(meetsMinimum(500, 500)).toBe(true)
  })
  it('writes a safe payout CSV', () => {
    const csv = payoutsCsv([{ createdAt: '2026-11-16T01:00:00Z', name: 'Sam, Jr', email: 'sam@x.com', amountCents: 1234, note: '=HYPERLINK("x")' }])
    expect(csv.split('\r\n')[0]).toBe('Date,Affiliate,Email,Amount,Note')
    expect(csv).toContain('2026-11-16,"Sam, Jr",sam@x.com,12.34,')
    expect(csv).toContain('\'=HYPERLINK')
  })
})
