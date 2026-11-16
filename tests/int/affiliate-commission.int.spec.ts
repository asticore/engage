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

describe('affiliate product and tier rates (26b)', () => {
  const none = new Map<number, number>()
  it('parses tiers and picks the highest reached', async () => {
    const { parseTiers, tierRate } = await import('@/features/affiliates/commission')
    const tiers = parseTiers('5000, 15\nbad line\n1000, 12\n0, 50')
    expect(tiers).toEqual([{ minCents: 100000, pct: 12 }, { minCents: 500000, pct: 15 }])
    expect(tierRate(tiers, 0, 10)).toBe(10)
    expect(tierRate(tiers, 100000, 10)).toBe(12)
    expect(tierRate(tiers, 900000, 10)).toBe(15)
  })
  it('works a commission line by line with product rates and a shared discount', async () => {
    const { commissionForLines, commissionCents } = await import('@/features/affiliates/commission')
    const lines = [{ productId: 1, lineCents: 6000 }, { productId: 2, lineCents: 4000 }]
    const flat = commissionForLines(lines, 10000, 0, { override: null, productRates: none, defaultPct: 10 })
    expect(flat).toMatchObject({ base: 10000, amount: 1000 })
    const mixed = commissionForLines(lines, 10000, 1000, { override: null, productRates: new Map([[1, 20]]), defaultPct: 10 })
    expect(mixed.base).toBe(9000)
    expect(mixed.amount).toBe(Math.round(5400 * 0.2 + 3600 * 0.1))
    expect(commissionCents(mixed.base, mixed.pct)).toBe(mixed.amount)
    const over = commissionForLines(lines, 10000, 0, { override: 5, productRates: new Map([[1, 20]]), defaultPct: 10 })
    expect(over.amount).toBe(500)
    const noLines = commissionForLines(null, 10000, 2500, { override: null, productRates: none, defaultPct: 10 })
    expect(noLines).toMatchObject({ base: 7500, amount: 750 })
  })
})

describe('affiliate report (26c)', () => {
  it('counts live orders, sales and conversion per visit', async () => {
    const { affiliateReport } = await import('@/features/affiliates/commission')
    expect(affiliateReport([], 0)).toEqual({ orders: 0, salesCents: 0, conversionPct: 0 })
    expect(affiliateReport([{ status: 'pending', base_cents: 5000 }, { status: 'paid', base_cents: 2500 }, { status: 'reversed', base_cents: 9000 }], 50)).toEqual({ orders: 2, salesCents: 7500, conversionPct: 4 })
  })
})
