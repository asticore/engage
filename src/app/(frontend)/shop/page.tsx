import Link from 'next/link'
import React from 'react'
import { notFound } from 'next/navigation'

import { BlockRenderer } from '@/components/blocks/BlockRenderer'
import { ProductCard } from '@/components/ProductCard'
import { WishlistHeart } from '@/components/WishlistHeart'
import { wishlistEnabled } from '@/features/ecommerce/lib/wishlist'
import { availableFilterOptions, filterHref, matchesAttributeFilters, parseAttributeFilters } from '@/features/ecommerce/filters'
import { excludeProtected } from '@/features/visibility/excludeProtected'
import { getEngine } from '@/lib/engine'
import { loadPromoBadges } from '@/features/ecommerce/lib/promoBadges'
import { getFeatureFlags } from '@/utilities/features'
import { currentRequestLocale, applyTranslations, applyTranslationsToDocs } from '@/features/multilingual/applyTranslations'
import { buildMetadata } from '@/utilities/seo'
import { buildPageJsonLd } from '@/features/seo/pageSchema'
import { getSeoContext } from '@/features/seo/settings'
import { listBreadcrumbs } from '@/features/seo/schemaNodes'
import { renderWithTemplate } from '@/features/siteTemplates/render'
import { paginate, parsePage } from '@/features/siteTemplates/archiveQueries'
import { storeTexts } from '@/features/uiStrings/storeTextsServer'
import { translateWith } from '@/features/uiStrings/t'
import type { UiStringKey } from '@/features/uiStrings/keys'
import { archiveQueryString, filterArchiveItems, parseArchiveFilters, sortArchiveItems } from '@/features/siteTemplates/archiveFilter'
import { archivePageHref } from '@/lib/templateWidgets'
import { brandOptionsOf, tagOptionsOf, tagNames } from '@/features/ecommerce/lib/productTaxonomy'
import { brandIdsForSlug, brandIn, tagIdsForSlug, tagIn } from '@/features/ecommerce/server/taxonomyFilters'
import { slugify } from '@/utilities/formatSlug'
import { setBlockContext, setRequestQuery } from '@/lib/blockContext'
import { productArchiveItems } from '@/lib/blockContextFrom'
import type { Product, ShopSetting } from '@/engage-types'

export async function generateMetadata() {
  return buildMetadata({ title: 'Shop', path: '/shop' })
}

export const dynamic = 'force-dynamic'

const CATEGORIES = [
  { label: 'Accessories', value: 'accessories' },
  { label: 'Jewellery', value: 'jewellery' },
  { label: 'Homeware', value: 'homeware' },
  { label: 'Gifting', value: 'gifting' },
]

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const flags = await getFeatureFlags()
  if (!flags.ecommerce) notFound()

  const params = await searchParams
  const storeDict = await storeTexts()
  const tx = (key: UiStringKey, vars?: Record<string, string | number>) => translateWith(storeDict, key, vars)
  setRequestQuery(params)
  const category = typeof params.category === 'string' ? params.category.slice(0, 40) : undefined
  const filters = parseAttributeFilters(params)
  const brandParam = typeof params.brand === 'string' ? slugify(params.brand.trim().slice(0, 80)) : ''
  const engine = await getEngine()
  const archiveFilters = parseArchiveFilters(params)
  // Brand and tag narrow the products in the database (their ids are looked up first), so the list is
  // the whole shop's matches, not the newest few hundred. Depth 1 gives the brand and tags as objects.
  const brandIds = brandParam ? await brandIdsForSlug(engine, brandParam) : null
  const tagIds = archiveFilters.tag ? await tagIdsForSlug(engine, archiveFilters.tag) : null
  const search = archiveFilters.q.trim()

  const baseClauses = [{ _status: { equals: 'published' } }, ...(category ? [{ category: { equals: category } }] : [])]
  const narrowed = Boolean(brandIds || tagIds || search)
  const [settings, { docs: scanned }, facetResult] = (await Promise.all([
    engine.findGlobal({ slug: 'shop-settings' }).catch((): null => null),
    engine.find({
      collection: 'products',
      where: {
        and: [
          ...baseClauses,
          ...(brandIds ? [brandIn(brandIds)] : []),
          ...(tagIds ? [tagIn(tagIds)] : []),
          ...(search ? [{ or: [{ title: { contains: search } }, { shortDescription: { contains: search } }] }] : []),
        ],
      },
      sort: '-createdAt',
      limit: 300,
      depth: 1,
    }),
    // The filter choices (brands, tags, attributes) still come from the whole category, not from the
    // narrowed list, so picking one brand does not hide the others. Read only when a filter is on.
    narrowed ? engine.find({ collection: 'products', where: { and: baseClauses }, sort: '-createdAt', limit: 300, depth: 1 }) : null,
  ])) as unknown as [ShopSetting | null, { docs: Product[] }, { docs: Product[] } | null]
  const promoBadges = await loadPromoBadges(engine)
  const locale = await currentRequestLocale()
  const open = await applyTranslationsToDocs(await excludeProtected('products', scanned), 'products', locale)
  const facetSource = facetResult ? await applyTranslationsToDocs(await excludeProtected('products', facetResult.docs), 'products', locale) : open
  const matchingAttributes = open.filter((product) => matchesAttributeFilters(product as never, filters))
  // The brand, tag and search params are applied by the query above. The price and sort are applied here, before paging.
  const matching = matchingAttributes
  const pool = matching.map((product) => {
    const p = product as unknown as { title?: unknown; shortDescription?: unknown; priceInAUD?: unknown; createdAt?: unknown; tags?: unknown }
    return { product, title: String(p.title ?? ''), excerpt: typeof p.shortDescription === 'string' ? p.shortDescription : '', price: p.priceInAUD, date: p.createdAt, categories: [] as string[], tags: tagNames(p.tags) }
  })
  const kept = filterArchiveItems(pool, { ...archiveFilters, category: '' })
  const ordered = archiveFilters.sort === 'newest' ? kept.map((k) => k.product) : sortArchiveItems(kept, archiveFilters.sort).map((k) => k.product)
  const paged = paginate(ordered, parsePage(params.page), 100)
  const products = paged.items
  // Every list link keeps the other active filters (category, tag, brand, price, search, sort).
  const shopHref = (over: { tag?: string; brand?: string }) => {
    const qs = new URLSearchParams(archiveQueryString({ ...archiveFilters, category: category ?? '', tag: over.tag ?? archiveFilters.tag }).slice(1))
    const brand = over.brand ?? brandParam
    if (brand) qs.set('brand', brand)
    const text = qs.toString()
    return `/shop${text ? `?${text}` : ''}`
  }
  const archiveBase = shopHref({})
  const pageHref = (n: number) => archivePageHref(archiveBase, n)
  const filterOptions = availableFilterOptions(facetSource as never[])
  const brandChoices = brandOptionsOf(facetSource)
  const tagChoices = tagOptionsOf(facetSource)
  const activeTag = archiveFilters.tag ? slugify(archiveFilters.tag) : ''

  const layout = settings?.archiveLayout || 'grid-4'
  const context = await getSeoContext()
  const jsonLd = context.enabled
    ? buildPageJsonLd({
        collection: 'pages',
        schemaType: 'CollectionPage',
        title: 'Shop',
        url: context.baseUrl + '/shop',
        baseUrl: context.baseUrl,
        siteName: context.siteName,
        breadcrumbs: listBreadcrumbs({ baseUrl: context.baseUrl, path: '/shop', name: 'Shop' }),
      })
    : null

  const filterLinkClassName = (active: boolean) =>
    `border-b hover:border-[var(--color-gold)] hover:opacity-100 ${
      active ? 'border-[var(--color-gold)] opacity-100' : 'border-transparent opacity-60'
    }`

  const body = (
    <div className="page-shell">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replaceAll('</', '</\\/') }}
        />
      )}
      {settings?.introBlocks && settings.introBlocks.length > 0 ? (
        settings.introBlocks.map((block, index) => <BlockRenderer key={block.id || index} block={block} index={index} />)
      ) : (
        <header className="page-header">
          <h1>Shop</h1>
          <p>Considered pieces for the modern romantic.</p>
        </header>
      )}

      {settings?.showCategoryFilters !== false && (
        <div className="mb-8 flex flex-wrap gap-4 text-[0.8rem] uppercase tracking-[0.06em]">
          <Link href="/shop" className={filterLinkClassName(!category)}>
            All
          </Link>
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.value}
              href={`/shop?category=${cat.value}`}
              className={filterLinkClassName(category === cat.value)}
            >
              {cat.label}
            </Link>
          ))}
        </div>
      )}

      {filterOptions.length > 0 && (
        <div className="mb-8 grid gap-3 text-[0.8rem]">
          {filterOptions.map((option) => (
            <div key={option.name} className="flex flex-wrap items-center gap-3">
              <span className="uppercase tracking-[0.06em] opacity-70">{option.name}</span>
              {option.values.map((value) => (
                <Link key={value} href={filterHref({ category }, filters, { name: option.name, value })} className={filterLinkClassName(filters[option.name]?.toLowerCase() === value.toLowerCase())}>
                  {value}
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}

      {(brandChoices.length > 0 || tagChoices.length > 0) && (
        <div className="mb-8 grid gap-3 text-[0.8rem]">
          {brandChoices.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="uppercase tracking-[0.06em] opacity-70">{tx('store.filterBrand')}</span>
              {brandChoices.map((brand) => (
                <Link key={brand.slug} href={shopHref({ brand: brandParam === brand.slug ? '' : brand.slug })} className={filterLinkClassName(brandParam === brand.slug)}>
                  {brand.name}
                </Link>
              ))}
            </div>
          )}
          {tagChoices.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="uppercase tracking-[0.06em] opacity-70">{tx('store.filterTag')}</span>
              {tagChoices.map((tag) => (
                <Link key={tag.slug} href={shopHref({ tag: activeTag === tag.slug ? '' : tag.name })} className={filterLinkClassName(activeTag === tag.slug)}>
                  {tag.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {products.length === 0 ? (
        <p className="empty-state">
          Nothing here yet - add products from the admin panel and they&apos;ll appear here
          automatically.
        </p>
      ) : (
        <div className={`product-grid product-grid--${layout}`}>
          {products.map((product) => (
            <div key={product.id} className="relative">
              <ProductCard product={product} promoBadges={promoBadges} showShortDescription={settings?.showShortDescriptionOnCard || false} aspect={settings?.productImageAspect || 'portrait'} />
              {wishlistEnabled(settings) && <div className="absolute right-3 top-3 z-10"><WishlistHeart productId={product.id} /></div>}
            </div>
          ))}
        </div>
      )}
      {paged.pages > 1 && (
        <nav className="mt-8 flex items-center justify-between" aria-label="Pagination">
          {paged.page > 1 ? <Link href={pageHref(paged.page - 1)} rel="prev">{tx('store.newerProducts')}</Link> : <span />}
          <span className="opacity-60">{tx('store.pageOf', { page: paged.page, pages: paged.pages })}</span>
          {paged.page < paged.pages ? <Link href={pageHref(paged.page + 1)} rel="next">{tx('store.olderProducts')}</Link> : <span />}
        </nav>
      )}
    </div>
  )
  const shopCategories = CATEGORIES.map((c) => ({ slug: c.value, name: c.label }))
  setBlockContext({
    path: '/shop',
    archive: {
      basePath: archiveBase,
      page: paged.page,
      pages: paged.pages,
      items: productArchiveItems(products),
      kind: 'products',
      filters: { ...archiveFilters, category: category ?? '' },
      facets: { categories: shopCategories, tags: tagChoices },
    },
  })
  return renderWithTemplate({ kind: 'archive-shop', ctx: { path: '/shop', productCategory: category ?? null }, content: body })
}
