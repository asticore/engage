import { describe, expect, it } from 'vitest'

import { freeShippingProgress, lowestFreeThreshold } from '@/features/ecommerce/lib/freeShipping'

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
})
