import React from 'react'

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

export const WAVE69_COMPONENTS: Record<string, React.ComponentType<P>> = {
  'product-stock': ProductStockElement as never,
  'product-short-description': ProductShortDescriptionElement as never,
  'product-meta': ProductMetaElement as never,
  'product-images': ProductImagesElement as never,
}
