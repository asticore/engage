import { NextResponse } from 'next/server'

import { normaliseCountry } from '@/features/consent/regions'
import { getEngine } from '@/lib/engine'

export const dynamic = 'force-dynamic'

const HEADERS = { 'Cache-Control': 'private, no-store' }
const SLUG = /^[a-z0-9][a-z0-9_-]{0,31}$/

/**
 * GET /api/visibility-state - { loggedIn, roles, country } for the block "Visibility rules" script.
 * Role slugs only: no id, name or email. Never cached, because the page that asks is cached for everyone.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const country = normaliseCountry(request.headers.get('cf-ipcountry'))
    const engine = await getEngine()
    const { user } = await engine.auth({ headers: request.headers })
    if (!user) return NextResponse.json({ loggedIn: false, roles: [], country, ordered: null }, { headers: HEADERS })
    const u = user as { roles?: unknown; customRole?: unknown }
    const roles: string[] = Array.isArray(u.roles) ? u.roles.filter((r): r is string => typeof r === 'string') : []
    const custom = u.customRole as { slug?: unknown } | null | undefined
    if (custom && typeof custom === 'object' && typeof custom.slug === 'string') roles.push(custom.slug)
    // One small lookup, only when a block on the page has a "Customer orders" condition.
    let ordered: boolean | null = null
    if (new URL(request.url).searchParams.get('orders') === '1') {
      const id = (user as { id?: unknown }).id
      if (typeof id === 'number' || typeof id === 'string') {
        const found = await engine.find({ collection: 'orders', where: { customer: { equals: id } }, limit: 1, depth: 0, overrideAccess: true } as never).catch((): null => null)
        if (found) ordered = ((found as { docs?: unknown[] }).docs ?? []).length > 0
      }
    }
    return NextResponse.json({ loggedIn: true, roles: roles.map((r) => r.toLowerCase()).filter((r) => SLUG.test(r)), country, ordered }, { headers: HEADERS })
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: HEADERS })
  }
}
