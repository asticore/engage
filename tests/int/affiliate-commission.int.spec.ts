import { describe, expect, it } from 'vitest'

import { afterRefund, balances, clampDays, clampPct, commissionBase, commissionCents, eligibleAt, isSelfReferral } from '@/features/affiliates/commission'

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
