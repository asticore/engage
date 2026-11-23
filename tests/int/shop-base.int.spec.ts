// @vitest-environment node
// The shop address (Permalinks > Shop address): the rules, and every place that builds a shop link follows it,
// including the cart, checkout, email and Stripe return links. /shop is the default, so nothing changes until one is set.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ shop: 'shop' as string }))

vi.mock('@/features/seo/permalinkStore', () => ({
  readBlogBase: async (): Promise<string> => 'blog',
  readShopBase: async (): Promise<string> => state.shop,
  invalidateBlogBaseCache: (): void => undefined,
}))
vi.mock('@/features/email', () => ({ sendEmail: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/engine', () => ({ getEngine: async () => ({}) }))
vi.mock('@/features/ecommerce/server/pricing', () => ({ loadPricedLines: vi.fn(async () => [{ unitCents: 2500 }]) }))
vi.mock('@/features/ecommerce/lib/shopCurrency', () => ({ loadShopCurrency: vi.fn(async () => 'AUD') }))
vi.mock('@/features/ecommerce/server/db', () => ({ rawD1: vi.fn(async () => { throw new Error('no database in tests') }) }))

import { DEFAULT_SHOP_BASE, resolveShopBase, shopPath, validateShopBase } from '@/features/seo/permalinks'
import { validateShopBaseField, SHOP_BASE_PAGE_MESSAGE } from '@/features/seo/permalinkValidate'
import { slugRedirectPaths } from '@/features/redirects/slugChange'
import { buildMergeContext } from '@/lib/mergeTags'
import { breadcrumbTrail } from '@/features/seo/schemaNodes'
import { categoryCrumbs, categoryUrl, subCategoryLinks } from '@/features/categories/frontend'
import { filterHref } from '@/features/ecommerce/filters'
import { buildFeedItems } from '@/features/ecommerce/lib/feeds'
import { reviewLinksFor } from '@/features/ecommerce/server/emails'
import { notifyBackInStock } from '@/features/ecommerce/backInStockNotify'
import { startSubscriptionCheckout } from '@/features/ecommerce/subscriptions/start'
import { publicPathFor } from '@/features/multilingual/documentRows'
import { blockContextFor, productArchiveItems } from '@/lib/blockContextFrom'
import { loopItemsFromDocs } from '@/features/siteTemplates/loopGrid'
import { sendEmail } from '@/features/email'

const ctx = { adminRoot: '/admin', signInPaths: ['/account/sign-in'] }
const rows = [
  { id: 1, scope: 'shop', name: 'Tea', slug: 'tea', parentId: null, sortOrder: 0 },
  { id: 2, scope: 'shop', name: 'Green', slug: 'green', parentId: 1, sortOrder: 0 },
]

beforeEach(() => {
  state.shop = 'store'
  vi.mocked(sendEmail).mockClear()
  process.env.SITE_URL = 'https://shop.test'
})

describe('shop address rules', () => {
  it('accepts a good address and the default', () => {
    expect(validateShopBase('store', ctx)).toBeNull()
    expect(validateShopBase('', ctx)).toBeNull()
    expect(validateShopBase('shop', ctx)).toBeNull()
    expect(validateShopBase('/our-store/', ctx)).toBeNull()
  })
  it('refuses bad format, site words, the blog address, admin and sign-in addresses', () => {
    expect(validateShopBase('Store', ctx)).toBe('format')
    expect(validateShopBase('ab', ctx)).toBe('length')
    expect(validateShopBase('cart', ctx)).toBe('reserved')
    expect(validateShopBase('checkout', ctx)).toBe('reserved')
    expect(validateShopBase('blog', ctx)).toBe('reserved')
    expect(validateShopBase('news', { ...ctx, blogBase: 'news' })).toBe('blog')
    expect(validateShopBase('studio-7f3', { ...ctx, adminRoot: '/studio-7f3' })).toBe('admin')
    expect(validateShopBase('welcome-in', { ...ctx, signInPaths: ['/welcome-in'] })).toBe('signIn')
  })
  it('resolves a stored value, falling back to /shop when it is bad or clashes', () => {
    expect(resolveShopBase(null)).toBe(DEFAULT_SHOP_BASE)
    expect(resolveShopBase('/store/')).toBe('store')
    expect(resolveShopBase('Bad Value')).toBe('shop')
    expect(resolveShopBase('cart')).toBe('shop')
    expect(resolveShopBase('news', 'news')).toBe('shop')
  })
  it('builds paths, defaulting to /shop', () => {
    expect(shopPath('store', '/mug')).toBe('/store/mug')
    expect(shopPath(undefined)).toBe('/shop')
    expect(shopPath('', '/mug')).toBe('/shop/mug')
  })
})

describe('shop address field validator', () => {
  const pages = (slugs: string[]) => ({
    engine: { find: async (args: Record<string, unknown>) => ({ docs: slugs.filter((s) => s === (args as { where: { and: { slug?: { equals: string } }[] } }).where.and[0].slug?.equals) }) },
  })
  it('accepts empty and the default, and gives a message for a refused value', async () => {
    const v = validateShopBaseField()
    expect(await v('')).toBe(true)
    expect(await v('shop')).toBe(true)
    expect(typeof (await v('ab'))).toBe('string')
  })
  it('refuses an address a top-level page already uses', async () => {
    const v = validateShopBaseField()
    expect(await v('store', { req: pages(['store']) })).toBe(SHOP_BASE_PAGE_MESSAGE)
    expect(await v('store', { req: pages(['about']) })).toBe(true)
  })
})

describe('places that build shop paths follow the address', () => {
  it('slug redirects, merge tags, breadcrumbs and loop links', () => {
    expect(slugRedirectPaths('products', 'a', 'b', undefined, 'store')).toEqual({ fromPath: '/store/a', toPath: '/store/b' })
    expect(slugRedirectPaths('products', 'a', 'b')).toEqual({ fromPath: '/shop/a', toPath: '/shop/b' })
    expect(slugRedirectPaths('posts', 'a', 'b', undefined, 'store')).toEqual({ fromPath: '/blog/a', toPath: '/blog/b' })
    expect(buildMergeContext({ slug: 'mug', title: 'Mug' }, 'products', undefined, undefined, 'store').url).toBe('/store/mug')
    expect(buildMergeContext({ slug: 'mug', title: 'Mug' }, 'products').url).toBe('/shop/mug')
    const trail = breadcrumbTrail({ collection: 'products', baseUrl: 'https://x.test', path: '/store/mug', title: 'Mug', shopBase: 'store' })
    expect(trail.map((c) => c.url)).toEqual(['https://x.test/', 'https://x.test/store', 'https://x.test/store/mug'])
    expect(loopItemsFromDocs('products', [{ slug: 'mug', title: 'Mug' }], undefined, 'store')[0].href).toBe('/store/mug')
    expect(loopItemsFromDocs('products', [{ slug: 'mug', title: 'Mug' }])[0].href).toBe('/shop/mug')
    expect(productArchiveItems([{ slug: 'mug', title: 'Mug' }], 'store')[0].href).toBe('/store/mug')
    expect(blockContextFor('products', { slug: 'mug', title: 'Mug' }, 'Site', 'blog', 'store')).toBeTruthy()
    expect(publicPathFor('products', 'mug', 'blog', 'store')).toBe('/store/mug')
    expect(publicPathFor('products', 'mug')).toBe('/shop/mug')
  })

  it('category pages and filters sit under the shop address', () => {
    expect(categoryUrl('shop', rows, 2, 'store')).toBe('/store/category/tea/green')
    expect(categoryUrl('shop', rows, 2)).toBe('/shop/category/tea/green')
    expect(categoryCrumbs('shop', rows, 2, 'store')[1]).toEqual({ label: 'Shop', url: '/store' })
    expect(subCategoryLinks('shop', rows, 1, 'store')).toEqual([{ name: 'Green', href: '/store/category/tea/green' }])
    expect(categoryUrl('blog', rows, 2, 'news')).toBe('/news/category/tea/green')
    expect(filterHref({ category: 'tea' }, {}, undefined, '/store')).toBe('/store?category=tea')
    expect(filterHref({}, {})).toBe('/shop')
  })
})

describe('cart, checkout, email and Stripe links', () => {
  it('the product feed links to the shop address', () => {
    const base = { baseUrl: 'https://shop.test', currency: 'AUD', brand: 'B' }
    const product = { id: 1, slug: 'mug', title: 'Mug', priceInAUD: 10, productType: 'simple', images: [{ url: '/a.jpg' }], manageStock: false }
    expect(buildFeedItems([product], { ...base, shopBase: 'store' })[0].link).toBe('https://shop.test/store/mug')
    expect(buildFeedItems([product], base)[0].link).toBe('https://shop.test/shop/mug')
  })

  it('the review-request email links to the shop address', () => {
    const order = { lineItems: [{ productId: 1 }] }
    const bySlug = new Map([[1, { slug: 'candle', title: 'Candle' }]])
    expect(reviewLinksFor(order, bySlug, 'store')).toBe('Candle: https://shop.test/store/candle#reviews')
    expect(reviewLinksFor(order, bySlug)).toBe('Candle: https://shop.test/shop/candle#reviews')
  })

  it('the back-in-stock email links to the shop address', async () => {
    const engine = {
      findGlobal: async () => ({}),
      find: async () => ({ docs: [{ id: 1, product: 7, variation: null as string | null, email: 'ann@example.com', status: 'pending' }] }),
      update: async () => ({}),
    }
    await notifyBackInStock(engine as never, { id: 7, title: 'Linen Shirt', slug: 'linen-shirt' }, [''])
    const body = JSON.stringify((vi.mocked(sendEmail).mock.calls as unknown as unknown[][])[0]?.[0])
    expect(body).toContain('https://shop.test/store/linen-shirt')
    expect(body).not.toContain('/shop/linen-shirt')
  })

  it('the Stripe subscription return links point at the shop address', async () => {
    const create = vi.fn(async (_params: Record<string, unknown>) => ({ url: 'https://checkout.stripe.test/s' }))
    const stripe = {
      prices: { list: async () => ({ data: [] as { id: string }[] }), create: async (p: { lookup_key: string }) => ({ id: `price_${p.lookup_key}` }) },
      customers: { list: async () => ({ data: [] as { id: string }[] }), create: async () => ({ id: 'cus_1' }) },
      checkout: { sessions: { create } },
    }
    const engine = {
      find: async () => ({ docs: [] as never[] }),
      findGlobal: async ({ slug }: { slug: string }) => (slug === 'shop-extra-settings' ? { subscriptionsEnabled: true } : { stripe: { enabled: true, secretKey: 'sk_test_fake' } }),
    }
    const product = { id: 7, title: 'Coffee box', slug: 'coffee-box', productType: 'simple', subscription: { enabled: true, interval: 'month', intervalCount: 1, trialDays: 0, signupFee: 0, paymentsLimit: 0 } }
    const result = await startSubscriptionCheckout({ engine: engine as never, user: { id: 3, email: 'b@example.com' }, product, origin: 'https://shop.test', client: stripe as never })
    if ('error' in result) throw new Error(result.error)
    const params = create.mock.calls[0]?.[0] as Record<string, unknown>
    expect(params.cancel_url).toBe('https://shop.test/store/coffee-box')
    expect(params.success_url).toBe('https://shop.test/account/subscriptions?started=1')
  })
})
