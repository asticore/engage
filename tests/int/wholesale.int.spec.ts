import { describe, expect, it } from 'vitest'

import { filterWholesaleVisible, isWholesaleBuyer, minOrderShortfallCents, normaliseTags, normaliseWholesaleConfig, pricesHiddenFor, productAllowedFor, validateApplication, wholesaleMoq } from '@/features/ecommerce/lib/wholesale'
import { applyPricingRules, normalisePricingRules } from '@/features/ecommerce/lib/pricingRules'
import { customerTypeList } from '@/features/ecommerce/server/customerTypes'

const on = normaliseWholesaleConfig({ wholesaleEnabled: true, wholesaleHidePrices: true, wholesaleMinOrder: 200 })
const guest = { signedIn: false, types: [] as string[] }
const retail = { signedIn: true, types: ['customer'] }
const buyer = { signedIn: true, types: ['customer', 'wholesale'] }
const admin = { signedIn: true, types: ['admin'] }

describe('wholesale config', () => {
  it('is off by default and reads the switches', () => {
    expect(normaliseWholesaleConfig(null).enabled).toBe(false)
    expect(on).toMatchObject({ enabled: true, role: 'wholesale', hidePrices: true, hideFrom: 'guests', minOrderCents: 20000 })
    expect(normaliseWholesaleConfig({ wholesaleEnabled: true, wholesaleRole: ' Trade ', wholesaleMinOrder: 0 })).toMatchObject({ role: 'trade', minOrderCents: null })
  })
})

describe('hidden prices', () => {
  it('hides from signed-out visitors only by default', () => {
    expect(pricesHiddenFor(on, guest)).toBe(true)
    expect(pricesHiddenFor(on, retail)).toBe(false)
  })
  it('can hide from everyone but wholesale accounts, never from admins', () => {
    const strict = normaliseWholesaleConfig({ wholesaleEnabled: true, wholesaleHidePrices: true, wholesaleHideFrom: 'non-wholesale' })
    expect(pricesHiddenFor(strict, retail)).toBe(true)
    expect(pricesHiddenFor(strict, buyer)).toBe(false)
    expect(pricesHiddenFor(strict, admin)).toBe(false)
  })
  it('does nothing while wholesale mode is off', () => {
    expect(pricesHiddenFor(normaliseWholesaleConfig({ wholesaleHidePrices: true }), guest)).toBe(false)
  })
})

describe('wholesale-only products', () => {
  it('shows them to wholesale accounts and admins only', () => {
    expect(productAllowedFor(on, true, guest)).toBe(false)
    expect(productAllowedFor(on, true, retail)).toBe(false)
    expect(productAllowedFor(on, true, buyer)).toBe(true)
    expect(productAllowedFor(on, true, admin)).toBe(true)
    expect(productAllowedFor(on, false, guest)).toBe(true)
  })
  it('ignores the flag while wholesale mode is off', () => {
    expect(productAllowedFor(normaliseWholesaleConfig(null), true, guest)).toBe(true)
  })
  it('filters a list', () => {
    const docs = [{ id: 1, wholesaleOnly: true }, { id: 2 }]
    expect(filterWholesaleVisible(on, docs, retail).map((d) => d.id)).toEqual([2])
    expect(filterWholesaleVisible(on, docs, buyer).map((d) => d.id)).toEqual([1, 2])
  })
})

describe('minimum order', () => {
  it('applies to wholesale accounts only', () => {
    expect(isWholesaleBuyer(on, buyer)).toBe(true)
    expect(minOrderShortfallCents(on, buyer, 15000)).toBe(5000)
    expect(minOrderShortfallCents(on, buyer, 20000)).toBe(0)
    expect(minOrderShortfallCents(on, retail, 100)).toBe(0)
    expect(minOrderShortfallCents(on, admin, 100)).toBe(0)
  })
})

describe('minimum quantity from a tier', () => {
  const tiers = [
    { productId: '5', variationId: null as string | null, customerType: null, minQty: 10, price: 9 },
    { productId: '5', variationId: null as string | null, customerType: 'wholesale', minQty: 12, price: 7 },
    { productId: '5', variationId: null as string | null, customerType: 'wholesale', minQty: 24, price: 6 },
  ]
  it('uses the buyer\'s own tiers', () => {
    expect(wholesaleMoq(tiers, '5', null, buyer)).toBe(12)
    expect(wholesaleMoq(tiers, '5', null, retail)).toBeNull()
    expect(wholesaleMoq(tiers, '6', null, buyer)).toBeNull()
  })
})

describe('applications and tags', () => {
  it('needs a company name', () => {
    expect(validateApplication({}).error).toMatch(/company/i)
    expect(validateApplication({ company: '  Acme   Pty ', taxId: '12 345' }).value).toMatchObject({ company: 'Acme Pty', taxId: '12 345' })
  })
  it('cleans tags', () => {
    expect(normaliseTags('VIP, tag:Stockist, vip, big spender')).toEqual(['vip', 'stockist', 'big-spender'])
    expect(normaliseTags(null)).toEqual([])
  })
})

describe('customer tags in pricing rules', () => {
  const rules = normalisePricingRules([{ name: 'VIP', appliesWhen: 'tag', discountType: 'percent', amount: 10, customerRole: 'VIP' }])
  const lines = [{ key: 'a', categories: [] as string[], quantity: 1, unitCents: 1000 }]
  it('matches a tag type and nothing else', () => {
    expect(applyPricingRules(rules, { lines, subtotalCents: 1000, customerRoles: customerTypeList(['customer'], [], ['tag:vip']) }).totalCents).toBe(100)
    expect(applyPricingRules(rules, { lines, subtotalCents: 1000, customerRoles: ['vip'] }).totalCents).toBe(0)
    expect(applyPricingRules(rules, { lines, subtotalCents: 1000, customerRoles: [] }).totalCents).toBe(0)
  })
})
