import { describe, it, expect } from 'vitest'
import { CARRIERS } from '@/features/ecommerce/shipping/catalogue'
import { getAdapter } from '@/features/ecommerce/shipping/registry'

/**
 * The carrier catalogue says which carriers have live rates and labels (the Shop settings text relies on it).
 * This pins that claim to the adapters: a carrier marked live must have a real adapter, and a carrier
 * without one must not claim live rates. Nothing here calls a carrier's network.
 */
describe('carrier live flags match the adapters', () => {
  for (const carrier of CARRIERS) {
    it(`${carrier.id}: live flags match the built-in adapter`, () => {
      const builtIn = getAdapter(carrier.id).constructor.name !== 'KeysOnlyAdapter'
      if (carrier.live.rates || carrier.live.labels) expect(builtIn, `${carrier.id} is marked live but has no adapter`).toBe(true)
      if (!builtIn) expect(carrier.live, `${carrier.id} has no adapter but claims live work`).toEqual({ rates: false, labels: false })
    })
  }

  it('the six carriers with built-in APIs are the ones marked live', () => {
    const live = CARRIERS.filter((c) => c.live.rates && c.live.labels).map((c) => c.id).sort()
    expect(live).toEqual(['auspost', 'dhl', 'fedex', 'sendle', 'shipstation', 'ups'])
  })
})
