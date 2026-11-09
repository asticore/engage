import Link from 'next/link'
import React from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { BreadcrumbsElement } from '@/components/blocks/elements/Wave36Elements'
import { ProductCard } from '@/components/ProductCard'
import { categoryCrumbs, categoryUrl, subCategoryLinks } from '@/features/categories/frontend'
import { listCategoriesSafe, linkedDocIds } from '@/features/categories/store'
import { descendantIds, resolvePath } from '@/features/categories/tree'
import { excludeProtected } from '@/features/visibility/excludeProtected'
import { applyTranslationsToDocs, currentRequestLocale } from '@/features/multilingual/applyTranslations'
import { renderWithTemplate } from '@/features/siteTemplates/render'
import { getEngine } from '@/lib/engine'
import { buildMetadata } from '@/utilities/seo'
import { getFeatureFlags } from '@/utilities/features'
import type { Product, ShopSetting } from '@/engage-types'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ path: string[] }> }

async function load(segments: string[]) {
  const rows = await listCategoriesSafe('shop')
  const category = resolvePath(rows, segments)
  return category ? { rows, category } : null
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { path } = await params
  const found = await load(path).catch((): null => null)
  if (!found) return { title: 'Not found', robots: { index: false, follow: false } }
  // The canonical address is the full path, whichever way the visitor arrived.
  return buildMetadata({ title: found.category.name, path: categoryUrl('shop', found.rows, found.category.id) })
}

/** A shop category page: breadcrumbs, links to sub categories, and the products of the category and everything below it. */
export default async function ShopCategoryPage({ params }: Params) {
  const flags = await getFeatureFlags()
  if (!flags.ecommerce) notFound()
  const { path } = await params
  const found = await load(path)
  if (!found) notFound()
  const { rows, category } = found

  const engine = await getEngine()
  const ids = await linkedDocIds(descendantIds(rows, category.id)).catch((): number[] => [])
  const [settings, result] = (await Promise.all([
    engine.findGlobal({ slug: 'shop-settings' }).catch((): null => null),
    ids.length
      ? engine.find({ collection: 'products', where: { and: [{ _status: { equals: 'published' } }, { id: { in: ids } }] }, sort: '-createdAt', limit: 100, depth: 1 })
      : Promise.resolve({ docs: [] }),
  ])) as unknown as [ShopSetting | null, { docs: Product[] }]
  const products = await applyTranslationsToDocs(await excludeProtected('products', result.docs), 'products', await currentRequestLocale())
  const subs = subCategoryLinks('shop', rows, category.id)
  const url = categoryUrl('shop', rows, category.id)

  const body = (
    <div className="page-shell">
      <BreadcrumbsElement items={categoryCrumbs('shop', rows, category.id)} separator=">" />
      <header className="page-header">
        <h1>{category.name}</h1>
      </header>
      {subs.length > 0 && (
        <nav aria-label="Sub categories" className="mb-8 flex flex-wrap gap-4 text-[0.8rem] uppercase tracking-[0.06em]">
          {subs.map((s) => (
            <Link key={s.href} href={s.href} className="border-b border-transparent opacity-60 hover:border-[var(--color-gold)] hover:opacity-100">
              {s.name}
            </Link>
          ))}
        </nav>
      )}
      {products.length === 0 ? (
        <p className="empty-state">Nothing in this category yet.</p>
      ) : (
        <div className={`product-grid product-grid--${settings?.archiveLayout || 'grid-4'}`}>
          {products.map((product) => (
            <div key={product.id} className="relative">
              <ProductCard product={product} showShortDescription={settings?.showShortDescriptionOnCard || false} aspect={settings?.productImageAspect || 'portrait'} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
  return renderWithTemplate({ kind: 'archive-shop', ctx: { path: url, productCategory: category.slug }, content: body })
}
