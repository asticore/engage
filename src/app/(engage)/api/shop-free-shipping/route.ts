import { NextResponse } from 'next/server'

import { getEngine } from '@/engine'
import { lowestFreeThreshold } from '@/features/ecommerce/lib/freeShipping'
import { loadShopConfig, type PricingEngine } from '@/features/ecommerce/server/pricing'

export const dynamic = 'force-dynamic'

/** GET: the lowest free-shipping threshold in dollars, or null. Public: it is the same number a shop shows in its banner. */
export async function GET(): Promise<Response> {
  try {
    const engine = (await getEngine()) as unknown as PricingEngine
    const config = await loadShopConfig(engine)
    return NextResponse.json({ threshold: lowestFreeThreshold(config.zones) }, { headers: { 'Cache-Control': 'public, max-age=60' } })
  } catch {
    return NextResponse.json({ threshold: null })
  }
}
