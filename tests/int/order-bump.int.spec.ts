import { describe, expect, it } from 'vitest'

import { orderBumpFields } from '@/features/ecommerce/collections/productFields'

describe('order bump fields', () => {
  it('has a product and a headline field', () => {
    const names = JSON.stringify(orderBumpFields)
    expect(names).toContain('orderBumpProduct')
    expect(names).toContain('orderBumpHeadline')
  })
})
