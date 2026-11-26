import { NextResponse } from 'next/server'

import { AD_PLACEMENTS_SLUG, AD_UNITS_SLUG } from '@/features/ads/slugs'
import { getEngine } from '@/lib/engine'

export const dynamic = 'force-dynamic'

/**
 * Admin only. GET ?kind=unit|placement -> { options: [{ value, label }] } for the Ad element's pickers
 * (value is the unit or placement key, which is what the element stores).
 */
const noStore = { 'Cache-Control': 'no-store' }

export async function GET(request: Request): Promise<Response> {
  const engine = await getEngine()
  const { user } = await engine.auth({ headers: request.headers })
  if (!user || !(user as { roles?: string[] }).roles?.includes('admin')) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: noStore })
  const kind = new URL(request.url).searchParams.get('kind') === 'placement' ? 'placement' : 'unit'
  const found = (await engine.find({ collection: (kind === 'placement' ? AD_PLACEMENTS_SLUG : AD_UNITS_SLUG) as never, limit: 200, depth: 0 }).catch(() => ({ docs: [] as never[] }))) as { docs: { key?: string; name?: string; enabled?: boolean }[] }
  const options = found.docs.filter((d) => d.key).map((d) => ({ value: String(d.key), label: `${d.name || d.key}${d.enabled === false ? ' (off)' : ''}` }))
  return NextResponse.json({ options }, { headers: noStore })
}
