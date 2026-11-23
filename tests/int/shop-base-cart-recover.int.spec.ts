// @vitest-environment node
// The abandoned-cart recovery link: a cart that cannot be restored sends the shopper to the shop address.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ shop: 'shop' as string, cart: null as Record<string, unknown> | null }))

vi.mock('@/features/seo/permalinkStore', () => ({ readShopBase: async (): Promise<string> => state.shop }))
vi.mock('@/features/ecommerce/lib/abandonedCart', () => ({ verifyCartToken: async () => ({ ok: true, cartId: 5 }) }))
vi.mock('@/engine', () => ({ getEngine: async () => ({ findByID: async () => state.cart }) }))

import { GET } from '@/app/(engage)/api/shop-cart-recover/route'

const call = () => GET(new Request('https://site.test/api/shop-cart-recover?t=abc'))

beforeEach(() => {
  state.shop = 'shop'
  state.cart = null
})

describe('cart recovery link', () => {
  it('sends a lost or paid cart to /shop by default', async () => {
    const res = await call()
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://site.test/shop')
  })

  it('sends it to the custom shop address when one is set', async () => {
    state.shop = 'store'
    state.cart = { id: 5, purchasedAt: '2026-01-01' }
    const res = await call()
    expect(res.headers.get('location')).toBe('https://site.test/store')
  })

  it('a live cart restores and goes to checkout, which has no shop address in it', async () => {
    state.shop = 'store'
    state.cart = { id: 5, secret: 's' }
    const html = await (await call()).text()
    expect(html).toContain("location.replace('/checkout')")
    expect(html).not.toContain('/store')
  })
})
