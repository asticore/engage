import Image from 'next/image'
import { shopPath } from '@/features/seo/permalinks'
import { readShopBase } from '@/features/seo/permalinkStore'
import { storeTexts } from '@/features/uiStrings/storeTextsServer'
import { translateWith } from '@/features/uiStrings/t'
import type { UiStringKey } from '@/features/uiStrings/keys'
import Link from 'next/link'
import React from 'react'

import { priceRange, type CatalogueProduct } from '@/features/ecommerce/catalogue'
import { priceInfo } from '@/features/ecommerce/pricing'
import { computeStockStatus } from '@/features/ecommerce/stock'
import { ProductCardPrice } from '@/components/ProductCardPrice'
import { PromoBadges } from '@/components/PromoBadges'
import { pricesHiddenFor } from '@/features/ecommerce/lib/wholesale'
import { wholesaleViewer } from '@/features/ecommerce/server/wholesale'
import { serviceBadge } from '@/features/ecommerce/lib/service'
import { badgesFor, type PromoBadge } from '@/features/ecommerce/lib/promoBadges'
import type { Media, Product } from '@/engage-types'

const getImageURL = (product: Product): string | null => {
  const first = product.images?.[0]
  if (first && typeof first === 'object') {
    return (first as Media).url ?? null
  }
  return null
}

export async function ProductCard({
  product,
  showShortDescription = false,
  aspect = 'portrait',
  promoBadges,
}: {
  product: Product
  showShortDescription?: boolean
  aspect?: 'portrait' | 'square'
  /** The shop's promo badges (loadPromoBadges); the ones whose rule matches this product are laid over the picture. */
  promoBadges?: PromoBadge[]
}) {
  // Wholesale mode: hidden prices show the shop's text instead (lib/wholesale.ts). Read once per request.
  const shopBase = await readShopBase()
  const { cfg, buyer } = await wholesaleViewer()
  const priceHidden = pricesHiddenFor(cfg, buyer)
  const storeDict = priceHidden ? await storeTexts() : null
  const tx = (key: UiStringKey) => (storeDict ? translateWith(storeDict, key) : '')
  const imageURL = getImageURL(product)
  const catalogue = product as unknown as CatalogueProduct
  const range = priceRange(catalogue)
  const info = priceInfo(catalogue)
  const variable = catalogue.productType === 'variable' && range.min !== null && range.max !== null && range.min !== range.max
  const soldOut = (catalogue.productType ?? 'simple') === 'simple' && computeStockStatus(catalogue) === 'outofstock'

  const badges = promoBadges?.length
    ? badgesFor(promoBadges, {
        slug: product.slug,
        category: product.category,
        tags: (product as unknown as { tags?: unknown }).tags,
        createdAt: product.createdAt,
        onSale: info.onSale,
        soldOut,
      })
    : []

  return (
    <Link
      href={shopPath(shopBase, `/${product.slug}`)}
      className={`product-card product-card--${aspect} block border border-[var(--color-line)] bg-white`}
    >
      <div className="product-card__image relative aspect-[4/5] overflow-hidden bg-[var(--color-cream-dim)]">
        {imageURL ? (
          <Image
            src={imageURL}
            alt={product.title}
            width={480}
            height={aspect === 'square' ? 480 : 600}
            style={{ objectFit: 'cover', width: '100%', height: '100%' }}
          />
        ) : (
          <div
            className="h-full w-full bg-[image:linear-gradient(135deg,var(--color-cream-dim),var(--color-gold-light))]"
            aria-hidden
          />
        )}
        <PromoBadges badges={badges} />
      </div>
      <div className="p-5">
        <span className="text-[0.7rem] uppercase tracking-[0.1em] text-[var(--color-gold)]">
          {product.category || 'Boutique'}
        </span>
        {serviceBadge(product as never) ? <span className="ml-2 text-[0.7rem] uppercase tracking-[0.1em] opacity-70">{serviceBadge(product as never)}</span> : null}
        <h3>{product.title}</h3>
        <p className="mt-1 font-[family-name:var(--font-display)] text-[1.25rem]">
          {priceHidden ? <span className="text-[0.85rem] opacity-70">{cfg.hiddenText || tx('store.wholesale.hiddenPrice')}</span> : <ProductCardPrice info={info} range={range} variable={variable} fallback={product.priceInAUD} />}
          {soldOut ? <span className="ml-2 text-[0.65rem] uppercase tracking-[0.1em] opacity-60">Sold out</span> : null}
        </p>
        {showShortDescription && product.shortDescription && (
          <p className="mt-1.5 text-[0.85rem] opacity-75">{product.shortDescription}</p>
        )}
      </div>
    </Link>
  )
}