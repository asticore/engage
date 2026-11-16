import { describe, expect, it } from 'vitest'

import { freeShippingProgress, lowestFreeThreshold, thresholdForAddress } from '@/features/ecommerce/lib/freeShipping'

describe('free shipping progress', () => {
  it('finds the lowest threshold among enabled free-over methods', () => {
    const zones = [
      { methods: [{ type: 'flat', title: 'a' }, { type: 'free_over_amount', title: 'b', freeOver: 100 }] },
      { methods: [{ type: 'free_over_amount', title: 'c', freeOver: 60 }, { type: 'free_over_amount', title: 'd', freeOver: 10, enabled: false }] },
    ] as never
    expect(lowestFreeThreshold(zones)).toBe(60)
    expect(lowestFreeThreshold([{ methods: [{ type: 'flat', title: 'x' }] }] as never)).toBeNull()
    expect(lowestFreeThreshold([])).toBeNull()
  })
  it('works out remaining and percent', () => {
    expect(freeShippingProgress(45, 60)).toEqual({ reached: false, remaining: 15, percent: 75 })
    expect(freeShippingProgress(60, 60)).toEqual({ reached: true, remaining: 0, percent: 100 })
    expect(freeShippingProgress(0, 60).percent).toBe(0)
    expect(freeShippingProgress(Number.NaN, 60).remaining).toBe(60)
  })
  it('uses the zone that matches the destination', () => {
    const zones = [
      { id: 1, name: 'AU', order: 0, regions: [{ type: 'country', country: 'AU' }], methods: [{ type: 'free_over_amount', title: 'au', freeOver: 100 }] },
      { id: 2, name: 'NZ', order: 1, regions: [{ type: 'country', country: 'NZ' }], methods: [{ type: 'flat', title: 'nz', cost: 9 }] },
      { id: 3, name: 'World', order: 2, regions: [], methods: [{ type: 'free_over_amount', title: 'w', freeOver: 250 }] },
    ] as never
    expect(thresholdForAddress(zones, { country: 'AU' })).toBe(100)
    expect(thresholdForAddress(zones, { country: 'NZ' })).toBeNull()
    expect(thresholdForAddress(zones, { country: 'US' })).toBe(250)
    expect(thresholdForAddress(zones, {})).toBe(100)
  })
})
