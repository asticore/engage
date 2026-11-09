// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { applyRounding, convertForDisplay, normaliseRounding } from '@/features/ecommerce/lib/displayCurrency'
import { validateDisplayCurrencies } from '@/features/ecommerce/lib/displayCurrencyRows'
import { storefrontOptions } from '@/features/ecommerce/server/displayCurrencies'
import { normalisePriceTiers, percentOffPrice, resolveTierPrice, tierNotes, validatePriceTiers } from '@/features/ecommerce/lib/priceTiers'
import { loadPricedLines } from '@/features/ecommerce/server/pricing'
import { UI_STRING_SOURCE } from '@/features/uiStrings'

describe('display currency rounding rules', () => {
  it('leaves the default alone and knows the four rules', () => {
    expect(convertForDisplay(10, 0.66, 2)).toBe(6.6)
    expect(normaliseRounding('ends99')).toBe('ends99')
    expect(normaliseRounding('nope')).toBe('none')
  })
  it('applies whole, nearest 0.05 and .99 endings', () => {
    expect(convertForDisplay(10, 0.66, 2, 'whole')).toBe(7)
    expect(convertForDisplay(10, 0.663, 2, 'nearest5')).toBe(6.65)
    expect(convertForDisplay(10, 0.66, 2, 'ends99')).toBe(6.99)
    expect(convertForDisplay(1, 150, 0, 'ends99')).toBe(150)
    expect(applyRounding(0.2, 'ends99', 2)).toBe(0.99)
    expect(convertForDisplay(null, 1, 2, 'whole')).toBeNull()
  })
  it('carries the rule through validation and the storefront options', () => {
    const checked = validateDisplayCurrencies([{ code: 'USD', rateMode: 'manual', manualRate: 0.66, rounding: 'ends99' }, { code: 'EUR', rateMode: 'manual', manualRate: 0.6, rounding: 'bad' }], 'AUD')
    expect(checked.error).toBeNull()
    expect(checked.rows.map((r) => r.rounding)).toEqual(['ends99', 'none'])
    const options = storefrontOptions([{ code: 'USD', enabled: 1, sort_order: 0, rate_mode: 'manual', manual_rate: 0.66, auto_rate: null, auto_rate_base: null, auto_rate_at: null, rounding: 'whole' }], 'AUD')
    expect(options[0].rounding).toBe('whole')
  })
})

const tiers = normalisePriceTiers([
  { productId: 1, minQty: 10, price: 8 },
  { productId: 1, minQty: 50, price: 6.5 },
  { productId: 1, minQty: 1, customerType: 'Wholesale', price: 7 },
  { productId: 1, variationId: 'v2', minQty: 5, price: 9 },
  { productId: 2, minQty: 2, price: 1 },
  { productId: 1, minQty: 0, price: 3 },
])

describe('price tiers', () => {
  const ctx = (quantity: number, customerTypes: string[] = [], variationId: string | null = null, basePrice = 10) => ({ productId: '1', variationId, quantity, customerTypes, basePrice })
  it('drops invalid rows', () => expect(tiers).toHaveLength(5))
  it('uses the normal price below the first break', () => expect(resolveTierPrice(tiers, ctx(9)).price).toBe(10))
  it('picks the break that has started', () => {
    expect(resolveTierPrice(tiers, ctx(10)).price).toBe(8)
    expect(resolveTierPrice(tiers, ctx(49)).price).toBe(8)
    expect(resolveTierPrice(tiers, ctx(50)).price).toBe(6.5)
  })
  it('applies wholesale only to wholesale buyers and takes the lowest price', () => {
    expect(resolveTierPrice(tiers, ctx(1)).price).toBe(10)
    expect(resolveTierPrice(tiers, ctx(1, ['wholesale'])).price).toBe(7)
    expect(resolveTierPrice(tiers, ctx(10, ['wholesale'])).price).toBe(7)
    expect(resolveTierPrice(tiers, ctx(50, ['wholesale'])).price).toBe(6.5)
  })
  it('limits variation tiers to that variation and never raises the price', () => {
    expect(resolveTierPrice(tiers, ctx(5, [], 'v2')).price).toBe(9)
    expect(resolveTierPrice(tiers, ctx(5, [], 'v1')).price).toBe(10)
    expect(resolveTierPrice(tiers, ctx(10, [], null, 7.5)).price).toBe(7.5)
  })
  it('writes public notes without wholesale prices', () => {
    const notes = tierNotes(tiers, { productId: '1', variationId: null, customerTypes: [], basePrice: 10 }, (n) => n.toFixed(2))
    expect(notes).toEqual(['Buy 10 or more: 8.00 each', 'Buy 50 or more: 6.50 each'])
  })
  it('validates a list and converts percentages', () => {
    expect(validatePriceTiers([{ productId: 1, minQty: 5, price: 1 }, { productId: 1, minQty: 5, price: 2 }]).error).toMatch(/same quantity/)
    expect(validatePriceTiers([{ productId: 1, minQty: 1.5, price: 1 }]).error).toBeTruthy()
    expect(validatePriceTiers([{ productId: 1, minQty: 5, price: 1 }]).error).toBeNull()
    expect(percentOffPrice(19.99, 10)).toBe(17.99)
  })
})

describe('tiers in checkout pricing', () => {
  const product = { id: 1, title: 'Widget', priceInAUD: 10, manageStock: false, _status: 'published', productType: 'simple' }
  const engine = {
    find: async () => ({ docs: [] as Record<string, unknown>[] }),
    findByID: async () => product,
    findGlobal: async () => ({}),
  }
  it('prices the unit by quantity and customer type, and keeps the normal price without tiers', async () => {
    const tierCtx = { tiers, customerTypes: ['wholesale'] }
    const [bulk] = await loadPricedLines(engine as never, [{ product: 1, quantity: 10 }], new Date(), true, { tiers, customerTypes: [] })
    expect(bulk.unitCents).toBe(800)
    const [wholesale] = await loadPricedLines(engine as never, [{ product: 1, quantity: 1 }], new Date(), true, tierCtx)
    expect(wholesale.unitCents).toBe(700)
    const [plain] = await loadPricedLines(engine as never, [{ product: 1, quantity: 10 }])
    expect(plain.unitCents).toBe(1000)
  })
})

describe('admin strings', () => {
  it('has English source text for the new screens', () => {
    for (const key of ['shop.tiers.title', 'shop.tiers.bulkDone', 'shop.currency.rounding.ends99', 'settings.link.price-tiers.label']) expect(UI_STRING_SOURCE[key as keyof typeof UI_STRING_SOURCE]).toBeTruthy()
  })
})
