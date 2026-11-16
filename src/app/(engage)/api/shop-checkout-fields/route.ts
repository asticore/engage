import { NextResponse } from 'next/server'

import { getEngine } from '@/engine'
import { loadShopConfig, type PricingEngine } from '@/features/ecommerce/server/pricing'

export const dynamic = 'force-dynamic'

/** GET: whether the Order notes checkout field is on, so the cart page only offers a note the checkout will keep. Public. */
export async function GET(): Promise<Response> {
  try {
    const engine = (await getEngine()) as unknown as PricingEngine
    const config = await loadShopConfig(engine)
    const on = config.fields.some((f) => f.key === 'orderNotes' && f.enabled)
    return NextResponse.json({ orderNotes: on }, { headers: { 'Cache-Control': 'public, max-age=60' } })
  } catch {
    return NextResponse.json({ orderNotes: false })
  }
}
