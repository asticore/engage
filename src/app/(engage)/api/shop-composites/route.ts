import { NextResponse } from 'next/server'

import { excludeProtected } from '@/features/visibility/excludeProtected'
import { getEngine } from '@/engine'
import { parseCompositePicks } from '@/features/ecommerce/lib/composite'
import { resolveComposite, type CompositeEngine } from '@/features/ecommerce/server/composite'
import { clientKey, hit } from '@/features/security/rateLimit'

export const dynamic = 'force-dynamic'

const MAX_LINES = 50

type Doc = Record<string, unknown> & { id: number; _status?: string | null }

/**
 * POST { lines: [{ key, productId, composite }] } - for each kit line in the cart, returns what one kit costs right now
 * (whole cents, or null when it cannot be bought), whether it is available, and a one-line summary of the picks.
 * Public fields only. The cart shows this; the server prices the order again at checkout.
 */
export async function POST(request: Request): Promise<Response> {
  const decision = hit(`shop-composites:${clientKey(request)}`, 60)
  if (decision.limited) {
    return NextResponse.json({ error: 'Too many requests. Try again in a moment.' }, { status: 429, headers: { 'Retry-After': String(decision.retryAfterSeconds) } })
  }
  const body = (await request.json().catch((): null => null)) as { lines?: unknown } | null
  if (!body || !Array.isArray(body.lines)) return NextResponse.json({ error: 'lines must be a list.' }, { status: 400 })
  const lines = (body.lines.slice(0, MAX_LINES) as Array<Record<string, unknown>>)
    .map((line) => ({ key: typeof line?.key === 'string' ? line.key.slice(0, 80) : '', productId: Number(line?.productId), composite: line?.composite }))
    .filter((line) => line.key && Number.isInteger(line.productId) && line.productId > 0)
  const out: Record<string, { priceCents: number | null; available: boolean; summary: string }> = {}
  if (lines.length === 0) return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
  const engine = (await getEngine()) as unknown as CompositeEngine & { find: (a: unknown) => Promise<{ docs: Doc[] }> }
  const ids = [...new Set(lines.map((line) => line.productId))]
  const { docs: found } = await engine
    .find({ collection: 'products', where: { and: [{ _status: { equals: 'published' } }, { productType: { equals: 'composite' } }, { id: { in: ids } }] }, limit: MAX_LINES, depth: 0, overrideAccess: true })
    .catch((): { docs: Doc[] } => ({ docs: [] }))
  const docs = await excludeProtected('products', found)
  for (const line of lines) {
    const doc = docs.find((d) => d.id === line.productId)
    if (!doc) continue
    const result = await resolveComposite(engine, doc, parseCompositePicks(line.composite), 1, new Date(), new Map())
    out[line.key] = { priceCents: result.ok ? result.unitCents : null, available: result.ok, summary: result.ok ? result.summary : '' }
  }
  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
}
