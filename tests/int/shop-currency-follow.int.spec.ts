import { describe, expect, it } from 'vitest'

import { eventOffers } from '@/features/seo/schemaNodes'
import { offersJsonLd, type ProductView } from '@/features/ecommerce/storefront'
import { formatCents } from '@/features/ecommerce/lib/money'

describe('prices follow the shop currency', () => {
  it('uses the shop currency for event ticket offers, and AUD only when none is given', () => {
    const base = { url: 'https://x.test/events/a', isOnline: false, tiers: [] as never[], ticketPrice: 20 }
    expect(eventOffers({ ...base, currency: 'NZD' })[0]).toMatchObject({ priceCurrency: 'NZD', price: 20 })
    expect(eventOffers(base)[0]).toMatchObject({ priceCurrency: 'AUD' })
  })
  it('uses the given currency for product offers', () => {
    const view = { type: 'simple', price: 12.5, regular: 12.5, onSale: false, stockStatus: 'instock', purchasable: true, variations: [], priceMin: 12.5, priceMax: 12.5 } as unknown as ProductView
    const offers = offersJsonLd(view, 'USD', '/shop/x') as { priceCurrency?: string } | null
    expect(JSON.stringify(offers)).toContain('USD')
    expect(offers?.priceCurrency ?? 'USD').toBe('USD')
  })
  it('formats cents in the currency it is given', () => {
    expect(formatCents(1999, 'USD')).toContain('19.99')
    expect(formatCents(1999, 'USD')).not.toBe(formatCents(1999, 'AUD'))
  })
})
