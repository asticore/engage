import { describe, expect, it } from 'vitest'

import { holdStock, normaliseStockHold, stockPool, sweepStockHolds } from '@/features/ecommerce/server/stockHold'

describe('stock hold settings', () => {
  it('is off by default with 15 minutes', () => {
    expect(normaliseStockHold(null)).toEqual({ enabled: false, minutes: 15, inCart: false })
  })
  it('clamps the minutes', () => {
    expect(normaliseStockHold({ stockHoldEnabled: true, stockHoldMinutes: 9999 })).toEqual({ enabled: true, minutes: 240, inCart: false })
    expect(normaliseStockHold({ stockHoldMinutes: 0 }).minutes).toBe(1)
  })
})

describe('stockPool', () => {
  it('uses the product pool for a simple product', () => {
    expect(stockPool({ id: 4, manageStock: true, stockQty: 3 }, null)).toEqual({ key: '4:', available: 3 })
  })
  it('uses the variation pool when it manages its own stock, else the product', () => {
    const p = { id: 4, manageStock: true, stockQty: 9, variations: [{ id: 'a', manageStock: true, stockQty: 2 }, { id: 'b', manageStock: false }] }
    expect(stockPool(p, 'a')).toEqual({ key: '4:a', available: 2 })
    expect(stockPool(p, 'b')).toEqual({ key: '4:', available: 9 })
  })
  it('counts nothing when stock is unmanaged or backorders are allowed', () => {
    expect(stockPool({ id: 1, manageStock: false }, null)).toBeNull()
    expect(stockPool({ id: 1, manageStock: true, stockQty: 1, backorders: 'yes' }, null)).toBeNull()
  })
})

function fakeDb(changes: number | 'throw') {
  const calls: unknown[][] = []
  return {
    calls,
    prepare: () => ({
      bind: (...v: unknown[]) => {
        calls.push(v)
        return { run: async () => (changes === 'throw' ? Promise.reject(new Error('x')) : { meta: { changes } }) }
      },
    }),
  }
}

describe('holdStock', () => {
  it('true when a row is written, false when none is', async () => {
    expect(await holdStock(fakeDb(1), 5, '4:', 2, 3, 15)).toBe(true)
    expect(await holdStock(fakeDb(0), 5, '4:', 2, 3, 15)).toBe(false)
  })
  it('null without a database or on an error', async () => {
    expect(await holdStock(null, 5, '4:', 2, 3, 15)).toBeNull()
    expect(await holdStock(fakeDb('throw'), 5, '4:', 2, 3, 15)).toBeNull()
  })
  it('expires after the minutes given', async () => {
    const db = fakeDb(1)
    const now = new Date('2026-01-01T00:00:00.000Z')
    await holdStock(db, 5, '4:', 1, 3, 20, now)
    expect(db.calls[0][3]).toBe('2026-01-01T00:20:00.000Z')
  })
})

describe('sweepStockHolds', () => {
  it('returns the number removed and 0 without a database', async () => {
    expect(await sweepStockHolds(fakeDb(3))).toBe(3)
    expect(await sweepStockHolds(null)).toBe(0)
  })
})

describe('stock hold in cart and countdown (Task 23e)', () => {
  it('the in-cart switch needs the checkout hold on', async () => {
    const { normaliseStockHold } = await import('@/features/ecommerce/server/stockHold')
    expect(normaliseStockHold({ stockHoldEnabled: true, stockHoldInCart: true }).inCart).toBe(true)
    expect(normaliseStockHold({ stockHoldEnabled: false, stockHoldInCart: true }).inCart).toBe(false)
    expect(normaliseStockHold({ stockHoldEnabled: true }).inCart).toBe(false)
  })
  it('formats the countdown', async () => {
    const { holdCountdown } = await import('@/features/ecommerce/lib/holdCountdown')
    expect(holdCountdown(754_000)).toEqual({ ended: false, label: '12:34' })
    expect(holdCountdown(3_725_000).label).toBe('1:02:05')
    expect(holdCountdown(0).ended).toBe(true)
    expect(holdCountdown(Number.NaN).ended).toBe(true)
  })
})
