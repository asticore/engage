import { NextResponse } from 'next/server'

import { excludeProtected } from '@/features/visibility/excludeProtected'
import { getEngine } from '@/engine'
import { computeStockStatus } from '@/features/ecommerce/stock'
import { priceInfo } from '@/features/ecommerce/pricing'
import { clientKey, hit } from '@/features/security/rateLimit'

export const dynamic = 'force-dynamic'

const MAX_CART_PRODUCTS = 50

type Doc = Record<string, unknown> & { id: number; _status?: string | null }
type Engine = { find: (a: unknown) => Promise<{ docs: Doc[] }> }

const idOf = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value
  if (value && typeof value === 'object' && 'id' in value) return idOf((value as { id: unknown }).id)
  return null
}

/**
 * POST { productIds: number[], bumpId?: number } - cart product ids in cart order.
 * Returns the first order bump offer that applies (public fields only), or null.
 * Offers are skipped when the product is unpublished, protected, out of stock or needs choices.
 * `bumpId` is the offer already ticked: it stays offered while in the cart so the box can be unticked.
 */
export async function POST(request: Request): Promise<Response> {
  const decision = hit(`shop-order-bump:${clientKey(request)}`, 60)
  if (decision.limited) {
    return NextResponse.json({ error: 'Too many requests. Try again in a moment.' }, { status: 429, headers: { 'Retry-After': String(decision.retryAfterSeconds) } })
  }
  const none = (): Response => NextResponse.json(null, { headers: { 'Cache-Control': 'no-store' } })
  const body = (await request.json().catch((): null => null)) as { productIds?: unknown; bumpId?: unknown } | null
  if (!body || !Array.isArray(body.productIds)) return NextResponse.json({ error: 'productIds must be a list.' }, { status: 400 })
  const productIds: number[] = []
  for (const raw of body.productIds.slice(0, MAX_CART_PRODUCTS)) {
    const id = idOf(raw)
    if (id !== null && !productIds.includes(id)) productIds.push(id)
  }
  if (productIds.length === 0) return none()
  const bumpId = idOf(body.bumpId)

  const engine = (await getEngine()) as unknown as Engine
  const { docs: cartDocs } = await engine
    .find({ collection: 'products', where: { id: { in: productIds } }, limit: MAX_CART_PRODUCTS, depth: 0, overrideAccess: true })
    .catch((): { docs: Doc[] } => ({ docs: [] }))
  const sources = cartDocs.filter((doc) => doc._status === 'published' && idOf(doc.orderBumpProduct) !== null)
  for (const source of sources) {
    const targetId = idOf(source.orderBumpProduct) as number
    if (productIds.includes(targetId) && targetId !== bumpId) continue
    const { docs } = await engine
      .find({ collection: 'products', where: { and: [{ _status: { equals: 'published' } }, { id: { equals: targetId } }] }, limit: 1, depth: 0, overrideAccess: true })
      .catch((): { docs: Doc[] } => ({ docs: [] }))
    const [doc] = await excludeProtected('products', docs)
    if (!doc || computeStockStatus(doc as never) === 'outofstock') continue
    if (doc.productType && doc.productType !== 'simple') continue
    const info = priceInfo(doc as never)
    const price = info.price ?? (typeof doc.priceInAUD === 'number' ? doc.priceInAUD : null)
    if (price === null) continue
    return NextResponse.json(
      { id: doc.id, title: String(doc.title ?? ''), price, headline: typeof source.orderBumpHeadline === 'string' ? source.orderBumpHeadline : '' },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }
  return none()
}
