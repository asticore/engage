import { NextResponse } from 'next/server'

import { getEngine } from '@/engine'
import { holdAndReadCartStock } from '@/features/ecommerce/server/cartHold'
import type { PricingEngine } from '@/features/ecommerce/server/pricing'
import { clientKey, hit } from '@/features/security/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * POST { cartID, secret } - holds the cart's stock when the shop has that switched on, and returns { expiresAt } (ISO time the
 * earliest hold ends, or null when nothing is held). The cart secret proves the caller owns the cart.
 */
export async function POST(request: Request): Promise<Response> {
  const decision = hit(`shop-stock-hold:${clientKey(request)}`, 30)
  if (decision.limited) return NextResponse.json({ expiresAt: null }, { status: 429, headers: { 'Retry-After': String(decision.retryAfterSeconds) } })
  const body = (await request.json().catch((): Record<string, unknown> => ({}))) as Record<string, unknown>
  const cartId = Number(body.cartID)
  if (!Number.isInteger(cartId) || typeof body.secret !== 'string') return NextResponse.json({ expiresAt: null }, { status: 404 })
  const engine = (await getEngine()) as unknown as PricingEngine & { findByID: (a: unknown) => Promise<Record<string, unknown> | null> }
  const cart = await engine.findByID({ collection: 'carts', id: cartId, depth: 0, overrideAccess: true }).catch((): null => null)
  if (!cart || !cart.secret || cart.secret !== body.secret || cart.purchasedAt) return NextResponse.json({ expiresAt: null }, { status: 404 })
  const result = await holdAndReadCartStock(engine, cartId, (cart.items as never) ?? [])
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
