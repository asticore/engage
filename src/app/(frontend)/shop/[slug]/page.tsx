import { notFound } from 'next/navigation'
import { contentAvailableHere, requestHost } from '@/features/domains/request'
import { pickForHost } from '@/features/domains/scope'
import { cookies } from 'next/headers'
import React, { cache } from 'react'
import type { Metadata } from 'next'
import { RichText } from '@/engine/editor/react'

import { formatPriceInAUD } from '@/lib/formatCurrency'
import { priceLocale } from '@/features/uiStrings/publicFormat'
import { publicLocale } from '@/features/uiStrings/storeTextsServer'
import { ProductPurchase, type GroupedChild } from '@/components/ProductPurchase'
import { BackInStockForm } from '@/components/BackInStockForm'
import { SubscriptionOffer } from '@/features/ecommerce/subscriptions/components/SubscriptionOffer'
import { ProductReviewForm } from '@/components/ProductReviewForm'
import { AdsPageScope } from '@/features/ads/components/AdsPageScope'
import { setBlockContext, setRequestQuery } from '@/lib/blockContext'
import { shopPath } from '@/features/seo/permalinks'
import { readShopBase } from '@/features/seo/permalinkStore'
import { productBlockContext } from '@/lib/blockContextFrom'
import { BlockRenderer } from '@/components/blocks/BlockRenderer'
import { FaqList } from '@/components/FaqList'
import { ProductCard } from '@/components/ProductCard'
import { WishlistHeart } from '@/components/WishlistHeart'
import { ProductGallery } from '@/components/ProductGallery'
import { ProductTaxonomy } from '@/components/ProductTaxonomy'
import { storeTexts } from '@/features/uiStrings/storeTextsServer'
import { translateWith } from '@/features/uiStrings/t'
import { BundleContentsList } from '@/components/BundleContentsList'
import { ProductRecommendations } from '@/components/ProductRecommendations'
import { bundleStorefrontFields } from '@/features/ecommerce/server/bundles'
import { compositeStorefront } from '@/features/ecommerce/server/composite'
import { VariationImageProvider } from '@/components/VariationImageProvider'
import { wishlistEnabled } from '@/features/ecommerce/lib/wishlist'
import type { CatalogueProduct } from '@/features/ecommerce/catalogue'
import { normaliseGiftCardSettings } from '@/features/ecommerce/lib/storedValue'
import { showBackInStockForm } from '@/features/ecommerce/lib/backInStock'
import { aggregateRatingJsonLd, summariseRatings } from '@/features/ecommerce/reviews'
import { buildProductView, offersJsonLd, withoutPrices } from '@/features/ecommerce/storefront'
import { preordersEnabledFrom } from '@/features/ecommerce/server/shopExtra'
import { shopRulesConfigFrom } from '@/features/ecommerce/server/pricingRules'
import { productPageNotes } from '@/features/ecommerce/lib/pricingRules'
import { currencyFromShopSettings } from '@/features/ecommerce/lib/shopCurrency'
import { tierNotes, variationTierNotes } from '@/features/ecommerce/lib/priceTiers'
import { variationLabel } from '@/features/ecommerce/catalogue'
import { loadTierContext } from '@/features/ecommerce/server/pricing'
import { normaliseWholesaleConfig, pricesHiddenFor, productAllowedFor, wholesaleMoq } from '@/features/ecommerce/lib/wholesale'
import { currentBuyer } from '@/features/ecommerce/server/wholesale'
import { PasswordGate } from '@/components/PasswordGate'
import { getPasswordGateState } from '@/features/visibility/gate'
import { excludeProtected } from '@/features/visibility/excludeProtected'
import { getEngine } from '@/lib/engine'
import { promoBadgesFrom } from '@/features/ecommerce/lib/promoBadges'
import { getFeatureFlags } from '@/utilities/features'
import { currentRequestLocale, applyTranslations, applyTranslationsToDocs } from '@/features/multilingual/applyTranslations'
import { sourceSlugFor } from '@/features/multilingual/slugIndex'
import { buildMetadata } from '@/utilities/seo'
import { PageJsonLd } from '@/features/seo'
import { renderWithTemplate } from '@/features/siteTemplates/render'
import type { Faq, Media, Product, ShopSetting } from '@/engage-types'

const STAR_ON = String.fromCharCode(0x2605)
const STAR_OFF = String.fromCharCode(0x2606)

export const dynamic = 'force-dynamic'

// Memoised per request: generateMetadata and the page both load the product.
const getProduct = cache(async (slug: string) => {
  const engine = await getEngine()
  const { docs } = (await engine.find({
    collection: 'products',
    where: { slug: { equals: slug } },
    limit: 0,
    depth: 1,
  })) as unknown as { docs: Product[] }
  // The same slug can exist on several domains: this domain's own product, else the shared one (features/domains/scope.ts).
  return pickForHost(docs, await requestHost(), (product) => (product as { availableDomains?: unknown }).availableDomains)
})

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug: requested } = await params
  const requestLocale = await currentRequestLocale()
  // A translated slug answers for its source product (localizedSlugs.ts).
  const slug = await sourceSlugFor(requestLocale, 'shop', requested, { redirect: false })
  const product = await applyTranslations(await getProduct(slug), 'products', requestLocale)
  if (!product) return {}

  // When password protected and locked, use generic metadata and keep it out of the index.
  const lockedMeta = await getPasswordGateState({ collection: 'products', id: product.id, cookies: await cookies() })
  if (lockedMeta === 'locked') {
    return { title: 'Password Protected', robots: { index: false, follow: false, googleBot: { index: false, follow: false } } }
  }

  return buildMetadata({
    title: product.title,
    seo: product.seo,
    availableDomains: (product as { availableDomains?: unknown }).availableDomains,
    path: shopPath(await readShopBase(), `/${slug}`),
    contentType: 'product',
    tokens: { price: formatPriceInAUD(product.priceInAUD, 'AUD', priceLocale(await publicLocale())), excerpt: product.shortDescription },
  })
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  setRequestQuery(sp)
  const flags = await getFeatureFlags()
  if (!flags.ecommerce) notFound()

  const { slug: requested } = await params
  const engine = await getEngine()
  // One read of the shop extra switches serves the badges, wholesale, pre-orders and rules below (the speed spec counts reads).
  const shopExtra = await engine.findGlobal({ slug: 'shop-extra-settings', depth: 0, overrideAccess: true }).catch((): null => null)
  const promoBadges = promoBadgesFrom(shopExtra)
  const requestLocale = await currentRequestLocale()
  // A source slug with a translation is redirected to the translated URL; a translated slug answers for its product.
  const slug = await sourceSlugFor(requestLocale, 'shop', requested, { redirect: true })
  const product = await applyTranslations(await getProduct(slug), 'products', requestLocale)
  const productPath = shopPath(await readShopBase(), `/${slug}`)

  if (!product) {
    notFound()
  }
  if (!(await contentAvailableHere((product as { availableDomains?: unknown }).availableDomains))) notFound()

  // Wholesale mode (Task 11d): wholesale-only products do not exist for anyone else, and hidden prices are removed before rendering.
  const wholesaleCfg = normaliseWholesaleConfig(shopExtra)
  const buyer = wholesaleCfg.enabled ? await currentBuyer() : { signedIn: false, types: [] as string[] }
  if (!productAllowedFor(wholesaleCfg, (product as { wholesaleOnly?: unknown }).wholesaleOnly, buyer)) notFound()
  const priceHidden = pricesHiddenFor(wholesaleCfg, buyer)

  const gateState = await getPasswordGateState({ collection: 'products', id: product.id, cookies: await cookies() })
  if (gateState === 'locked') {
    return <PasswordGate collection="products" currentPath={productPath} id={product.id} wrongPassword={sp.pw === 'wrong'} />
  }

  const [settings] = (await Promise.all([engine.findGlobal({ slug: 'shop-settings' }).catch((): null => null)])) as unknown as [ShopSetting | null]

  const images = (product.images || []).filter(
    (img): img is Media => typeof img === 'object' && img !== null,
  )
  const faqs = (product.faqs || []).filter((f): f is Faq => typeof f === 'object' && f !== null)

  let related: Product[] = []
  if (settings?.showRelatedProducts !== false && product.category) {
    const { docs } = (await engine.find({
      collection: 'products',
      where: {
        and: [
          { _status: { equals: 'published' } },
          { category: { equals: product.category } },
          { id: { not_equals: product.id } },
        ],
      },
      limit: 4,
    })) as unknown as { docs: Product[] }
    related = await excludeProtected('products', docs)
  }

  const catalogue = product as unknown as CatalogueProduct & Record<string, unknown>
  const mediaUrls = new Map<number, string>(images.filter((img) => img.url).map((img) => [img.id, img.url as string]))
  const preordersOn = preordersEnabledFrom(shopExtra)
  // A bundle's price and stock come from the products inside it (server/bundles.ts), so they replace the bundle's own fields here.
  const bundle = catalogue.productType === 'bundle' ? await bundleStorefrontFields(engine as never, product as never, new Date(), preordersOn) : null
  // A kit's steps and what each item adds to the price are worked out from the items on offer (server/composite.ts).
  const composite = catalogue.productType === 'composite' ? await compositeStorefront(engine as never, product as never, new Date(), preordersOn) : null
  const shopRules = shopRulesConfigFrom(shopExtra)
  // Quantity breaks open to everyone, plus the viewer's own customer-type tiers (wholesale) when they are signed in. The page is rendered per request.
  const tierCtx = await loadTierContext([{ product: product.id }], buyer.types)
  const noteLocale = priceLocale(await publicLocale())
  const breakNotes = typeof catalogue.priceInAUD === 'number' ? tierNotes(tierCtx.tiers, { productId: String(product.id), variationId: null, customerTypes: buyer.types, basePrice: catalogue.priceInAUD }, (units) => formatPriceInAUD(units, currencyFromShopSettings(settings), noteLocale)) : []
  const fmtMoney = (units: number) => formatPriceInAUD(units, currencyFromShopSettings(settings), noteLocale)
  const variationBreakNotes = variationTierNotes(
    tierCtx.tiers,
    { productId: String(product.id), customerTypes: buyer.types },
    (Array.isArray(catalogue.variations) ? catalogue.variations : [])
      .filter((v): v is NonNullable<typeof v> & { id: string } => Boolean(v && typeof v.id === 'string'))
      .map((v) => ({ id: v.id, label: variationLabel(v), price: typeof v.priceInAUD === 'number' ? v.priceInAUD : typeof catalogue.priceInAUD === 'number' ? catalogue.priceInAUD : 0 })),
    fmtMoney,
  )
  const moq = wholesaleCfg.enabled ? wholesaleMoq(tierCtx.tiers, String(product.id), null, buyer) : null
  const fullView = buildProductView(bundle ? { ...catalogue, ...bundle } : catalogue, new Date(), mediaUrls, {
    preorders: preordersOn,
    addOnsOn: shopRules.addOnsOn,
    pricingNotes: [...(moq ? [translateWith(await storeTexts(), 'store.wholesale.moq', { qty: moq })] : []), ...(shopRules.rulesOn ? productPageNotes(shopRules.rules) : []), ...breakNotes, ...variationBreakNotes],
  })

  const view = priceHidden ? withoutPrices(fullView) : fullView

  const asDocs = (value: unknown): Array<Record<string, unknown> & { id: number }> =>
    (Array.isArray(value) ? value : []).filter((entry): entry is Record<string, unknown> & { id: number } => typeof entry === 'object' && entry !== null)
  const giftSettings = normaliseGiftCardSettings((settings as { giftCards?: unknown } | null)?.giftCards)
  const giftConfig = view.type === 'giftcard' && giftSettings.enabled ? { presets: giftSettings.presetAmounts, allowCustom: giftSettings.allowCustomAmount, min: giftSettings.minAmount, max: giftSettings.maxAmount } : undefined
  const groupedOpen = view.type === 'grouped' ? await excludeProtected('products', asDocs(catalogue.groupedProducts)) : []
  const grouped: GroupedChild[] = view.type === 'grouped'
    ? groupedOpen
        .filter((child) => child._status === 'published' && child.id !== product.id)
        .slice(0, 50)
        .map((child) => ({ id: child.id, title: String(child.title ?? ''), slug: typeof child.slug === 'string' ? child.slug : null, view: priceHidden ? withoutPrices(buildProductView(child as unknown as CatalogueProduct, new Date(), new Map(), { preorders: preordersOn })) : buildProductView(child as unknown as CatalogueProduct, new Date(), new Map(), { preorders: preordersOn }) }))
    : []
  const upsells = (await excludeProtected('products', asDocs(catalogue.upsells))).filter((item) => item._status === 'published' && item.id !== product.id).slice(0, 4) as unknown as Product[]

  // Approved reviews only; the public API never returns the reviewer's email.
  const { docs: reviewDocs } = (await engine
    .find({ collection: 'product-reviews', where: { and: [{ product: { equals: product.id } }, { status: { equals: 'approved' } }] }, sort: '-createdAt', limit: 50, depth: 0 })
    .catch((): { docs: never[] } => ({ docs: [] }))) as unknown as { docs: Array<{ id: number; name: string; rating: number; text: string; status: string; verifiedOwner?: boolean; createdAt: string }> }
  const ratings = summariseRatings(reviewDocs)
  const storeDict = await storeTexts()
  const tx = (key: 'store.productBrand' | 'store.productTags') => translateWith(storeDict, key) ?? ''
  const taxonomy = product as unknown as { brand?: unknown; tags?: unknown }
  const reviewsOn = (settings as { reviewsEnabled?: boolean } | null)?.reviewsEnabled !== false
  // Same brand the Google feed uses: the feed brand, else the business name.
  const brandSource = settings as { storefront?: { feedBrand?: string | null }; tax?: { businessName?: string | null } } | null
  const brandName = (brandSource?.storefront?.feedBrand || brandSource?.tax?.businessName || '').trim()
  const jsonLdExtra: Record<string, unknown> = {
    ...(view.sku ? { sku: view.sku } : {}),
    ...(brandName ? { brand: { '@type': 'Brand', name: brandName } } : {}),
    ...(offersJsonLd(view, currencyFromShopSettings(settings), productPath) ? { offers: offersJsonLd(view, currencyFromShopSettings(settings)) } : {}),
    ...(aggregateRatingJsonLd(ratings) ? { aggregateRating: aggregateRatingJsonLd(ratings) } : {}),
  }

  setBlockContext(productBlockContext(priceHidden ? ({ ...product, priceInAUD: undefined } as unknown as Record<string, unknown>) : (product as unknown as Record<string, unknown>), productPath))
  const body = (
    <div className="page-shell grid grid-cols-[1.1fr_0.9fr] gap-14 max-[900px]:grid-cols-1">
      <AdsPageScope collection="products" noAds={(product as { noAds?: boolean }).noAds} />
      <PageJsonLd collection="products" doc={product} path={productPath} extra={jsonLdExtra} />
      <ProductGallery images={images} title={product.title} />

      <div>
        {product.category && (
          <span className="text-[0.75rem] uppercase tracking-[0.1em] text-[var(--color-gold)]">
            {product.category}
          </span>
        )}
        <h1 className="text-[2.75rem]">{product.title}</h1>
        {ratings.average ? (
          <p className="mb-2 text-[0.9rem]" aria-label={`Rated ${ratings.average} out of 5`}>
            {STAR_ON.repeat(Math.round(ratings.average))}
            {STAR_OFF.repeat(5 - Math.round(ratings.average))} {ratings.average} ({ratings.count})
          </p>
        ) : null}
        {product.shortDescription && (
          <p className="mb-6 text-[rgba(20,17,15,0.7)]">{product.shortDescription}</p>
        )}
        <ProductTaxonomy brand={taxonomy.brand} tags={taxonomy.tags} brandLine={tx('store.productBrand')} tagsLine={tx('store.productTags')} />

        {bundle ? <BundleContentsList items={bundle.contents} /> : null}
        <ProductPurchase productId={product.id} view={view} grouped={grouped} giftConfig={giftConfig} composite={priceHidden ? null : composite} hiddenPriceText={priceHidden ? wholesaleCfg.hiddenText || translateWith(storeDict, 'store.wholesale.hiddenPrice') : undefined} />
        <SubscriptionOffer product={product} />
        {showBackInStockForm(settings, catalogue) && !view.preorder.active ? <BackInStockForm productId={product.id} /> : null}
        {wishlistEnabled(settings) && <div className="mt-4"><WishlistHeart productId={product.id} showLink /></div>}

        {view.details.length > 0 && (
          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[0.9rem]">
            {view.details.map((detail) => (
              <React.Fragment key={detail.name}>
                <dt className="opacity-70">{detail.name}</dt>
                <dd className="m-0">{detail.values.join(', ')}</dd>
              </React.Fragment>
            ))}
          </dl>
        )}

        {product.description && (
          <div className="mt-8 border-t border-[var(--color-line)] pt-6">
            <RichText data={product.description} />
          </div>
        )}
      </div>

      {(product.layout || []).map((block, index) => (
        <BlockRenderer key={block.id || index} block={block} index={index} />
      ))}

      {faqs.length > 0 && (
        <div className="page-shell col-span-full mt-16">
          <h2>Questions about this piece</h2>
          <FaqList faqs={faqs} layout="accordion" />
        </div>
      )}

      {reviewsOn && (
        <div className="page-shell col-span-full mt-16" id="reviews">
          <h2>Reviews</h2>
          {reviewDocs.length === 0 ? <p>No reviews yet.</p> : null}
          <ul className="m-0 mb-8 list-none p-0">
            {reviewDocs.map((review) => (
              <li key={review.id} className="border-b border-[var(--color-line)] py-4">
                <p className="m-0" aria-label={`${review.rating} out of 5`}>
                  {STAR_ON.repeat(review.rating)}
                  {STAR_OFF.repeat(5 - review.rating)}
                </p>
                <p className="my-1 whitespace-pre-wrap">{review.text}</p>
                <p className="m-0 text-[0.8rem] opacity-70">
                  {review.name}
                  {review.verifiedOwner ? <span className="ml-2 inline-block border border-current px-1.5 text-[0.7rem] uppercase tracking-[0.04em]">Verified buyer</span> : null}
                </p>
              </li>
            ))}
          </ul>
          <h3>Write a review</h3>
          <ProductReviewForm productId={product.id} />
        </div>
      )}

      {upsells.length > 0 && (
        <div className="page-shell col-span-full mt-16">
          <div className="section-heading">
            <h2>You may also like</h2>
          </div>
          <div className="product-grid">
            {upsells.map((item) => (
              <ProductCard key={item.id} product={item} promoBadges={promoBadges} />
            ))}
          </div>
        </div>
      )}

      <ProductRecommendations productId={product.id} category={product.category ? String(product.category) : null} />

      {related.length > 0 && (
        <div className="page-shell col-span-full mt-16">
          <div className="section-heading">
            <h2>You might also like</h2>
          </div>
          <div className="product-grid">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} promoBadges={promoBadges} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
  // The provider wraps the whole template output, not only the built-in body: template blocks such as
  // product-images sit beside the content slot and must also see the chosen variation.
  return (
    <VariationImageProvider>
      {await renderWithTemplate({
        kind: 'single-product',
        ctx: { path: productPath, productCategory: product.category ? String(product.category) : null, productType: typeof catalogue.productType === 'string' ? catalogue.productType : null },
        content: body,
      })}
    </VariationImageProvider>
  )
}
