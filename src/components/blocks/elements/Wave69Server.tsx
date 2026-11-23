import React from 'react'

import { RichText } from '@/engine/editor/react'
import { ProductRecommendations } from '@/components/ProductRecommendations'
import { getBlockContext } from '@/lib/blockContext'

import { ProductGallery } from './Wave69Elements'
import './wave69.css'

/** Wave 69 product widgets (Task 10). Server components reading the product from the block context (public data only). */

type P = Record<string, unknown>
const s = (v: unknown, fallback: string): string => (typeof v === 'string' && v.trim() ? v : fallback)

export type StockState = { kind: 'in' | 'low' | 'out' | 'backorder'; count?: number }

/** Stock state from inventory (null or missing means not tracked, so in stock). */
export function stockState(inventory: number | null | undefined, lowAt: number, backorders?: string): StockState {
  if (typeof inventory !== 'number') return { kind: 'in' }
  if (inventory <= 0) return backorders && backorders !== 'no' ? { kind: 'backorder' } : { kind: 'out' }
  return inventory <= lowAt ? { kind: 'low', count: inventory } : { kind: 'in' }
}

export async function ProductStockElement(props: P): Promise<React.ReactElement | null> {
  const product = getBlockContext().product
  if (!product) return null
  const low = typeof product.lowStockThreshold === 'number' && product.lowStockThreshold > 0 ? product.lowStockThreshold : Number(props.lowAt) || 5
  const st = stockState(product.inventory, low, product.backorders)
  const text = {
    in: s(props.inStockText, 'In stock'),
    low: s(props.lowStockText, 'Only {count} left').replace('{count}', String(st.count ?? '')),
    out: s(props.outOfStockText, 'Out of stock'),
    backorder: s(props.backorderText, 'Available on backorder'),
  }[st.kind]
  return <p className={`w69-stock w69-stock--${st.kind}`}>{text}</p>
}

export async function ProductShortDescriptionElement(): Promise<React.ReactElement | null> {
  const text = getBlockContext().product?.shortDescription
  return text ? <p className="w69-short">{text}</p> : null
}

export async function ProductMetaElement(props: P): Promise<React.ReactElement | null> {
  const p = getBlockContext().product
  if (!p) return null
  const rows: Array<[string, string]> = []
  if (props.showSku !== false && p.sku) rows.push(['SKU', p.sku])
  if (props.showGtin === true && p.gtin) rows.push(['GTIN', p.gtin])
  if (props.showCategory !== false && p.category) rows.push(['Category', p.category])
  if (!rows.length) return null
  return (
    <dl className="w69-meta">
      {rows.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
    </dl>
  )
}

export async function ProductImagesElement(props: P): Promise<React.ReactElement | null> {
  const p = getBlockContext().product
  const images = p?.images?.length ? p.images : p?.featuredImage && typeof p.featuredImage.url === 'string' ? [{ url: p.featuredImage.url, alt: typeof p.featuredImage.alt === 'string' ? p.featuredImage.alt : '' }] : []
  if (!images.length) return null
  return <ProductGallery images={images} thumbnails={props.thumbnails !== false} zoom={props.zoom !== false} />
}

export type TabId = 'description' | 'info' | 'reviews'

/** Which tabs have something to show, in order, honouring the switches. */
export function tabsFor(p: { description?: unknown; sku?: string; gtin?: string; weight?: number; dimensions?: string; ratingCount?: number | null }, on: { description: boolean; info: boolean; reviews: boolean }): TabId[] {
  const out: TabId[] = []
  if (on.description && p.description) out.push('description')
  if (on.info && (p.sku || p.gtin || p.weight || p.dimensions)) out.push('info')
  if (on.reviews && typeof p.ratingCount === 'number' && p.ratingCount > 0) out.push('reviews')
  return out
}

const TAB_LABEL: Record<TabId, string> = { description: 'Description', info: 'Additional information', reviews: 'Reviews' }

export async function ProductTabsElement(props: P): Promise<React.ReactElement | null> {
  const p = getBlockContext().product
  if (!p) return null
  const tabs = tabsFor(p, { description: props.showDescription !== false, info: props.showInfo !== false, reviews: props.showReviews !== false })
  if (!tabs.length) return null
  const info: Array<[string, string]> = []
  if (p.sku) info.push(['SKU', p.sku])
  if (p.gtin) info.push(['GTIN', p.gtin])
  if (p.weight) info.push(['Weight', String(p.weight)])
  if (p.dimensions) info.push(['Dimensions', p.dimensions])
  const id = `w69t-${p.id ?? 0}`
  return (
    <div className="w69-tabs">
      {tabs.map((t, i) => (
        <React.Fragment key={t}>
          <input type="radio" name={id} id={`${id}-${t}`} className="w69-tabs__radio" defaultChecked={i === 0} />
          <label htmlFor={`${id}-${t}`} className="w69-tabs__tab">{TAB_LABEL[t]}</label>
        </React.Fragment>
      ))}
      {tabs.map((t) => (
        <div key={t} className={`w69-tabs__panel w69-tabs__panel--${t}`}>
          {t === 'description' ? <RichText data={p.description as never} /> : null}
          {t === 'info' ? <dl className="w69-meta">{info.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}</dl> : null}
          {t === 'reviews' ? <p>Rated {(p.ratingAverage ?? 0).toFixed(1)} out of 5 from {p.ratingCount} reviews.</p> : null}
        </div>
      ))}
    </div>
  )
}

export async function RelatedProductsElement(): Promise<React.ReactElement | null> {
  const p = getBlockContext().product
  if (typeof p?.id !== 'number') return null
  return <ProductRecommendations productId={p.id} category={p.category ?? null} />
}

export const WAVE69_COMPONENTS: Record<string, React.ComponentType<P>> = {
  'product-stock': ProductStockElement as never,
  'product-short-description': ProductShortDescriptionElement as never,
  'product-meta': ProductMetaElement as never,
  'product-images': ProductImagesElement as never,
  'product-tabs': ProductTabsElement as never,
  'related-products': RelatedProductsElement as never,
}
