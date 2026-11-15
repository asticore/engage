import { describe, expect, it } from 'vitest'

import { buildHandoff, checkoutHandoffUrl, decodeHandoff, normaliseCheckoutConfig } from '@/features/forms/checkoutHandoff'
import { normaliseFormConfig } from '@/features/forms/config'

const config = normaliseCheckoutConfig({ enabled: true, productId: 12, quantity: 2, map: { email: 'email', name: 'full_name', note: 'message', bogus: 'x', phone: 'bad name!' } })

describe('form checkout handoff', () => {
  it('normalises settings and drops unusable mappings', () => {
    expect(config).toMatchObject({ enabled: true, productId: 12, quantity: 2, map: { email: 'email', name: 'full_name', note: 'message' } })
    expect(config.map).not.toHaveProperty('phone')
    expect(normaliseCheckoutConfig(null).enabled).toBe(false)
    expect(normaliseCheckoutConfig({ enabled: true, quantity: 0 }).quantity).toBe(1)
    expect(normaliseFormConfig({ checkout: { enabled: true, productId: 5 } }).checkout?.productId).toBe(5)
  })
  it('builds a handoff from a fixed product and the mapped fields', () => {
    const h = buildHandoff(config, { email: ' a@b.co ', full_name: 'Ada Lovelace', message: 'Leave at door', other: 'ignored' }, 41)
    expect(h).toEqual({ product: 12, variation: null, quantity: 2, entry: 41, customer: { email: 'a@b.co', name: 'Ada Lovelace', note: 'Leave at door' } })
  })
  it('takes the product from a choice field, and refuses a junk choice', () => {
    const c = normaliseCheckoutConfig({ enabled: true, choiceField: 'plan', productId: 1 })
    expect(buildHandoff(c, { plan: '33:v9' })).toMatchObject({ product: 33, variation: 'v9' })
    expect(buildHandoff(c, { plan: 'gold' })).toBeNull()
    expect(buildHandoff(normaliseCheckoutConfig({ enabled: true }), {})).toBeNull()
    expect(buildHandoff(normaliseCheckoutConfig({ enabled: false, productId: 1 }), {})).toBeNull()
  })
  it('round trips through the address, including non-ASCII text', () => {
    const h = buildHandoff(config, { full_name: 'Zoë Müller 田中' }, 7)!
    const url = checkoutHandoffUrl(h)
    expect(url.startsWith('/checkout?handoff=')).toBe(true)
    expect(decodeHandoff(url.split('=')[1])).toEqual(h)
  })
  it('rejects malformed tokens', () => {
    expect(decodeHandoff('not base64 !!')).toBeNull()
    expect(decodeHandoff(btoa('{"product":-1,"quantity":1}'))).toBeNull()
    expect(decodeHandoff('e30')).toBeNull()
  })
})
