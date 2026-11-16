import { NextResponse } from 'next/server'

import { getEngine } from '@/engine'
import { DEFAULT_CART_UI, normaliseCartUi } from '@/features/ecommerce/lib/miniCart'

export const dynamic = 'force-dynamic'

/** GET: what the cart button and add to cart do (page, drawer or dropdown). Public, it only changes how the storefront behaves. */
export async function GET(): Promise<Response> {
  try {
    const engine = await getEngine()
    const doc = await engine.findGlobal({ slug: 'shop-extra-settings', depth: 0, overrideAccess: true })
    return NextResponse.json(normaliseCartUi(doc), { headers: { 'Cache-Control': 'public, max-age=60' } })
  } catch {
    return NextResponse.json(DEFAULT_CART_UI)
  }
}
