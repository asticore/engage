import { getEngine } from '@/engine'

import { readShopBase } from '@/features/seo/permalinkStore'
import { excludeProtected } from '@/features/visibility/excludeProtected'
import { effectiveRate, convertForDisplay, minorDigits, normaliseRounding, type RoundingRule } from '../lib/displayCurrency'
import { buildFeedItems, type FeedItem } from '../lib/feeds'
import { mappedFields } from '../lib/feedMapping'
import { matchesFeedFilters, type FeedRecord } from '../lib/feedRecords'
import { resolveTierPrice } from '../lib/priceTiers'
import { rawD1 } from './db'
import { listDisplayCurrencyRows } from './displayCurrencies'
import { listPriceTiers } from './priceTiers'
import { loadWholesaleConfig } from './wholesale'

type Doc = Record<string, unknown>

/**
 * Loads the published products and turns them into feed rows, or null when feeds are switched off in Shop settings
 * (the routes then answer 404, like the sitemap does).
 */
export async function loadFeed(request: Request): Promise<{ items: FeedItem[]; title: string; link: string } | null> {
  const engine = (await getEngine()) as unknown as {
    find: (a: unknown) => Promise<{ docs: Doc[] }>
    findGlobal: (a: unknown) => Promise<Doc>
  }
  const shop = (await engine.findGlobal({ slug: 'shop-settings', depth: 0, overrideAccess: true }).catch((): Doc => ({}))) as { storefront?: Doc; tax?: Doc }
  const sf = shop.storefront ?? {}
  if (sf.feedsEnabled !== true) return null
  const origin0 = new URL(request.url).origin
  // Wholesale mode with hidden prices: a public feed has no viewer, so it would show prices to everyone. Publish no rows instead.
  const wholesaleCfg = await loadWholesaleConfig(engine as never)
  if (wholesaleCfg.enabled && wholesaleCfg.hidePrices) return { items: [], title: String((await engine.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }).catch((): Doc => ({}))).siteName || shop.tax?.businessName || 'Shop'), link: origin0 }
  const payment = (await engine.findGlobal({ slug: 'payment-settings', depth: 0, overrideAccess: true }).catch((): Doc => ({}))) as { general?: { currency?: string } }
  const site = (await engine.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }).catch((): Doc => ({}))) as { siteName?: string }
  const found = await engine.find({ collection: 'products', where: { _status: { equals: 'published' } }, limit: 1000, depth: 1, overrideAccess: true })
  // Password protected products never appear in a public feed (fails closed to an empty feed).
  const products = { docs: await excludeProtected('products', found.docs as { id?: number | string | null }[]) as Doc[] }
  const origin = new URL(request.url).origin
  const title = String(site.siteName || shop.tax?.businessName || 'Shop')
  const condition = ['new', 'used', 'refurbished'].includes(String(sf.feedCondition)) ? (sf.feedCondition as 'new' | 'used' | 'refurbished') : 'new'
  const items = buildFeedItems(products.docs, {
    baseUrl: origin,
    shopBase: await readShopBase(),
    currency: String(payment.general?.currency || 'AUD'),
    brand: String(sf.feedBrand || shop.tax?.businessName || title),
    condition,
    googleCategory: typeof sf.feedGoogleCategory === 'string' ? sf.feedGoogleCategory : '',
  })
  return { items, title, link: origin }
}

/**
 * The rows for one feed record: its own filters, currency, price tier and stock rule. Unlike the two built-in feeds it
 * does not need "Product feeds" switched on in Shop settings, because the secret address is the access control.
 */
export async function loadFeedFor(request: Request, feed: FeedRecord): Promise<{ items: FeedItem[]; title: string; link: string }> {
  const engine = (await getEngine()) as unknown as {
    find: (a: unknown) => Promise<{ docs: Doc[] }>
    findGlobal: (a: unknown) => Promise<Doc>
  }
  const shop = (await engine.findGlobal({ slug: 'shop-settings', depth: 0, overrideAccess: true }).catch((): Doc => ({}))) as { storefront?: Doc; tax?: Doc }
  const sf = shop.storefront ?? {}
  const payment = (await engine.findGlobal({ slug: 'payment-settings', depth: 0, overrideAccess: true }).catch((): Doc => ({}))) as { general?: { currency?: string } }
  const site = (await engine.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }).catch((): Doc => ({}))) as { siteName?: string }
  const found = await engine.find({ collection: 'products', where: { _status: { equals: 'published' } }, limit: 1000, depth: 1, overrideAccess: true })
  const open = (await excludeProtected('products', found.docs as { id?: number | string | null }[])) as Doc[]
  const products = open.filter((p) => matchesFeedFilters(p, feed))
  const origin = new URL(request.url).origin
  const title = String(site.siteName || shop.tax?.businessName || 'Shop')
  const condition = ['new', 'used', 'refurbished'].includes(String(sf.feedCondition)) ? (sf.feedCondition as 'new' | 'used' | 'refurbished') : 'new'
  const shopCurrency = String(payment.general?.currency || 'AUD')

  const d1 = await rawD1()
  let currency = shopCurrency
  let rate = 1
  let digits = 2
  let rounding: RoundingRule = 'none'
  if (feed.currency && feed.currency !== shopCurrency) {
    const row = (await listDisplayCurrencyRows(d1)).find((r) => r.code === feed.currency)
    const usable = row ? effectiveRate(row) : null
    // A currency with no usable rate falls back to the shop currency rather than publishing wrong prices.
    if (row && usable) {
      currency = feed.currency
      rate = usable
      digits = minorDigits(feed.currency)
      rounding = normaliseRounding(row.rounding)
    }
  }
  const tiers = feed.priceTier ? await listPriceTiers(d1) : []
  const convert = (n: number): number => (rate === 1 ? n : (convertForDisplay(n, rate, digits, rounding) ?? n))

  const items = buildFeedItems(products, {
    baseUrl: origin,
    shopBase: await readShopBase(),
    currency,
    brand: String(sf.feedBrand || shop.tax?.businessName || title),
    condition,
    googleCategory: typeof sf.feedGoogleCategory === 'string' ? sf.feedGoogleCategory : '',
    map: (product) => mappedFields(product, feed.mapping),
    price: (productId, variationId, regular, current) => {
      const tiered = feed.priceTier ? resolveTierPrice(tiers, { productId, variationId, quantity: 1, customerTypes: [feed.priceTier.toLowerCase()], basePrice: current }).price : current
      return { regular: convert(regular), current: convert(Math.min(tiered, current)) }
    },
  })
  return { items: feed.includeOutOfStock ? items : items.filter((i) => i.availability !== 'out of stock'), title, link: origin }
}
