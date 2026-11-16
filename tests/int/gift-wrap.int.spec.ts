import { describe, expect, it } from 'vitest'

import { GIFT_WRAP_NOTE, giftWrapFee, normaliseGiftWrap, withGiftWrapNote } from '@/features/ecommerce/lib/giftWrap'
import { computeOrderTotals, type PricedLine } from '@/features/ecommerce/lib/totals'

describe('normaliseGiftWrap', () => {
  it('is off by default', () => {
    expect(normaliseGiftWrap(null)).toEqual({ enabled: false, feeCents: 0 })
  })
  it('needs both the switch and a fee above zero', () => {
    expect(normaliseGiftWrap({ giftWrapEnabled: true, giftWrapFee: 0 }).enabled).toBe(false)
    expect(normaliseGiftWrap({ giftWrapEnabled: true, giftWrapFee: 4.5 })).toEqual({ enabled: true, feeCents: 450 })
    expect(normaliseGiftWrap({ giftWrapEnabled: false, giftWrapFee: 5 }).enabled).toBe(false)
  })
})

describe('giftWrapFee and note', () => {
  const on = { enabled: true, feeCents: 500 }
  it('charges only when asked for and offered', () => {
    expect(giftWrapFee(on, true)).toBe(500)
    expect(giftWrapFee(on, false)).toBe(0)
    expect(giftWrapFee({ enabled: false, feeCents: 500 }, true)).toBe(0)
  })
  it('adds a line to the order note', () => {
    expect(withGiftWrapNote(null, 500)).toBe(GIFT_WRAP_NOTE)
    expect(withGiftWrapNote('Leave at door', 500)).toBe(`Leave at door\n${GIFT_WRAP_NOTE}`)
    expect(withGiftWrapNote('Leave at door', 0)).toBe('Leave at door')
  })
})

describe('computeOrderTotals with gift wrap', () => {
  const line: PricedLine = { key: '1', productId: '1', name: 'Mug', unitCents: 2000, quantity: 1, taxClass: 'standard', categories: [], onSale: false, weightGrams: 100, shippingClass: null, requiresShipping: false } as PricedLine
  const base = { lines: [line], address: { country: 'AU' }, zones: [] as never[], rates: [] as never[], settings: { pricesIncludeTax: false, defaultCountry: 'AU', storeRatePct: 10, enabled: false } }
  it('adds the fee to the total', () => {
    const r = computeOrderTotals({ ...base, giftWrapCents: 500 })
    expect(r.ok && r.giftWrapCents).toBe(500)
    expect(r.ok && r.totalCents).toBe(2500)
  })
  it('is zero without the fee', () => {
    const r = computeOrderTotals(base)
    expect(r.ok && r.giftWrapCents).toBe(0)
    expect(r.ok && r.totalCents).toBe(2000)
  })
})
