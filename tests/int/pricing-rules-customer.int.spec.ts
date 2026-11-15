import { describe, expect, it } from 'vitest'

import { applyPricingRules, normalisePricingRules, productPageNotes } from '@/features/ecommerce/lib/pricingRules'

const lines = [{ key: '0', categories: [] as string[], quantity: 1, unitCents: 10000 }]
const rules = (row: Record<string, unknown>) => normalisePricingRules([{ name: 'R', amount: 10, discountType: 'percent', ...row }])
const run = (row: Record<string, unknown>, customer?: { lifetimeSpendCents: number; orderCount: number; country: string }) =>
  applyPricingRules(rules(row), { lines, subtotalCents: 10000, customer })

describe('pricing rules by customer', () => {
  it('spend over 5000 gets 10 percent, and it shows as an applied rule', () => {
    const r = run({ appliesWhen: 'lifetimeSpend', minLifetimeSpend: 5000 }, { lifetimeSpendCents: 600000, orderCount: 3, country: 'AU' })
    expect(r.totalCents).toBe(1000)
    expect(r.applied).toEqual([{ id: 'rule-0', name: 'R', cents: 1000 }])
  })
  it('a customer under the spend, or one we know nothing about, gets nothing', () => {
    expect(run({ appliesWhen: 'lifetimeSpend', minLifetimeSpend: 5000 }, { lifetimeSpendCents: 400000, orderCount: 3, country: 'AU' }).totalCents).toBe(0)
    expect(run({ appliesWhen: 'lifetimeSpend', minLifetimeSpend: 5000 }).totalCents).toBe(0)
    expect(run({ appliesWhen: 'lifetimeSpend' }, { lifetimeSpendCents: 999999, orderCount: 3, country: 'AU' }).totalCents).toBe(0)
  })
  it('matches on the number of past orders', () => {
    expect(run({ appliesWhen: 'orderCount', minOrders: 3 }, { lifetimeSpendCents: 0, orderCount: 3, country: '' }).totalCents).toBe(1000)
    expect(run({ appliesWhen: 'orderCount', minOrders: 3 }, { lifetimeSpendCents: 0, orderCount: 2, country: '' }).totalCents).toBe(0)
  })
  it('matches on the shipping country, ignoring case', () => {
    expect(run({ appliesWhen: 'country', country: 'nz' }, { lifetimeSpendCents: 0, orderCount: 0, country: 'NZ' }).totalCents).toBe(1000)
    expect(run({ appliesWhen: 'country', country: 'NZ' }, { lifetimeSpendCents: 0, orderCount: 0, country: 'AU' }).totalCents).toBe(0)
    expect(run({ appliesWhen: 'country' }, { lifetimeSpendCents: 0, orderCount: 0, country: 'AU' }).totalCents).toBe(0)
  })
  it('does not advertise customer specific rules on the product page', () => {
    expect(productPageNotes(rules({ appliesWhen: 'lifetimeSpend', minLifetimeSpend: 5000, showOnProduct: true }))).toEqual([])
    expect(productPageNotes(rules({ appliesWhen: 'country', country: 'AU', showOnProduct: true }))).toHaveLength(1)
  })
})
