import { describe, expect, it } from 'vitest'

import { payLine, toCents } from '@/components/blocks/elements/Wave72Elements'
import { getElementDef } from '@/lib/elements/registry'
import { SITE_ELEMENT_TYPES } from '@/lib/elements/wave38Defs'

describe('wave72 pay button', () => {
  it('registers as a client element', () => {
    expect(getElementDef('pay-button')).toBeTruthy()
    expect(SITE_ELEMENT_TYPES.has('pay-button')).toBe(false)
  })
  it('converts typed amounts to cents', () => {
    expect(toCents('25')).toBe(2500)
    expect(toCents('19.99')).toBe(1999)
    expect(toCents('abc')).toBeNull()
  })
  it('needs a product', () => {
    expect(payLine({}, '')).toMatchObject({ ok: false })
  })
  it('adds a fixed price product without an amount', () => {
    expect(payLine({ productId: 7, quantity: 2 }, '')).toEqual({ ok: true, product: 7, quantity: 2 })
  })
  it('checks a typed amount against the minimum', () => {
    expect(payLine({ productId: 7, askAmount: true, minAmount: 5 }, '3')).toMatchObject({ ok: false })
    expect(payLine({ productId: 7, askAmount: true, minAmount: 5 }, '')).toMatchObject({ ok: false })
    expect(payLine({ productId: 7, askAmount: true, minAmount: 5 }, '12.5')).toEqual({ ok: true, product: 7, quantity: 1, priceCents: 1250 })
  })
})
