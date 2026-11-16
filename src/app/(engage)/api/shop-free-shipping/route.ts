import { NextResponse } from 'next/server'

import { getEngine } from '@/engine'
import { thresholdForAddress } from '@/features/ecommerce/lib/freeShipping'
import { loadShopConfig, type PricingEngine } from '@/features/ecommerce/server/pricing'

export const dynamic = 'force-dynamic'

/** GET ?country=&state=&postcode=: the free-shipping threshold in dollars for that destination (the lowest of all zones without a country), or null. Public: it is the same number a shop shows in its banner. */
export async function GET(request: Request): Promise<Response> {
  try {
    const engine = (await getEngine()) as unknown as PricingEngine
    const params = new URL(request.url).searchParams
    const address = { country: params.get('country')?.trim().toUpperCase().slice(0, 2) || undefined, state: params.get('state')?.trim().slice(0, 20) || undefined, postalCode: params.get('postcode')?.trim().slice(0, 12) || undefined }
    const config = await loadShopConfig(engine)
    return NextResponse.json({ threshold: thresholdForAddress(config.zones, address) }, { headers: { 'Cache-Control': 'public, max-age=60' } })
  } catch {
    return NextResponse.json({ threshold: null })
  }
}
