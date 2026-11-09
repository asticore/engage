import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { MAX_TIERS_PER_PRODUCT, normalisePriceTiers, percentOffPrice, validatePriceTiers, type PriceTier } from '@/features/ecommerce/lib/priceTiers'
import { loadShopCurrency } from '@/features/ecommerce/lib/shopCurrency'
import { rawD1 } from '@/features/ecommerce/server/db'
import { listPriceTiers, savePriceTiers } from '@/features/ecommerce/server/priceTiers'

export const dynamic = 'force-dynamic'

type Ctx = Awaited<ReturnType<typeof getAdminContext>>
type ProductRow = { id: number; title?: string; priceInAUD?: number | null }

async function authorize(action: 'read' | 'update'): Promise<{ ctx: Ctx } | { response: Response }> {
  const ctx = await getAdminContext()
  if (!ctx.user) return { response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }
  if (!(ctx.isAdmin || ctx.can('settings:shop-settings', action))) return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { ctx }
}

const BULK_LIMIT = 1000

/**
 * GET: the products (id, title, normal price) and the shop currency. With ?productId=ID, that product's tiers too.
 * POST { productId, tiers } replaces one product's tiers.
 * POST { action: 'bulk', scope: 'all' | number[], rules: [{ minQty, customerType, percentOff }] } sets the same
 *   percentage tiers on many products at once (each tier price is worked out from the product's own price).
 */
export async function GET(request: Request): Promise<Response> {
  const auth = await authorize('read')
  if ('response' in auth) return auth.response
  const engine = auth.ctx.engine as never as { find: (a: unknown) => Promise<{ docs: ProductRow[] }> }
  const currency = await loadShopCurrency(auth.ctx.engine as never)
  const productId = new URL(request.url).searchParams.get('productId')
  const products = (await engine.find({ collection: 'products', limit: BULK_LIMIT, depth: 0, overrideAccess: true, sort: 'title' })).docs
  const tiers = productId ? await listPriceTiers((await rawD1()) as never, [productId]) : []
  return NextResponse.json(
    { currency, maxTiers: MAX_TIERS_PER_PRODUCT, products: products.map((p) => ({ id: p.id, title: p.title ?? String(p.id), price: typeof p.priceInAUD === 'number' ? p.priceInAUD : null })), tiers },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function POST(request: Request): Promise<Response> {
  const auth = await authorize('update')
  if ('response' in auth) return auth.response
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const d1 = (await rawD1()) as never
  const now = new Date()

  if (body.action === 'bulk') {
    const rules = Array.isArray(body.rules) ? (body.rules as Record<string, unknown>[]) : []
    if (rules.length === 0 || rules.length > MAX_TIERS_PER_PRODUCT) return NextResponse.json({ error: 'Add at least one tier rule.' }, { status: 400 })
    for (const r of rules) {
      const pct = Number(r.percentOff)
      if (!Number.isInteger(Number(r.minQty)) || Number(r.minQty) < 1 || !Number.isFinite(pct) || pct <= 0 || pct >= 100) {
        return NextResponse.json({ error: 'Each rule needs a quantity of 1 or more and a percentage off between 0 and 100.' }, { status: 400 })
      }
    }
    const engine = auth.ctx.engine as never as { find: (a: unknown) => Promise<{ docs: ProductRow[] }> }
    const wanted = body.scope === 'all' ? null : new Set((Array.isArray(body.scope) ? body.scope : []).map(String))
    if (wanted && wanted.size === 0) return NextResponse.json({ error: 'Choose which products to change.' }, { status: 400 })
    const products = (await engine.find({ collection: 'products', limit: BULK_LIMIT, depth: 0, overrideAccess: true })).docs.filter((p) => (!wanted || wanted.has(String(p.id))) && typeof p.priceInAUD === 'number' && p.priceInAUD > 0)
    let changed = 0
    for (const p of products) {
      const existing = await listPriceTiers(d1, [String(p.id)])
      const added: PriceTier[] = normalisePriceTiers(
        rules.map((r) => ({ productId: p.id, variationId: null as string | null, customerType: r.customerType, minQty: r.minQty, price: percentOffPrice(p.priceInAUD as number, Number(r.percentOff)) })),
      )
      const key = (t: PriceTier) => `${t.variationId ?? ''}|${t.customerType ?? ''}|${t.minQty}`
      const replaced = new Set(added.map(key))
      const merged = [...existing.filter((t) => !replaced.has(key(t))), ...added].slice(0, MAX_TIERS_PER_PRODUCT)
      await savePriceTiers(d1, String(p.id), merged, now)
      changed += 1
    }
    return NextResponse.json({ changed })
  }

  const productId = body.productId === undefined || body.productId === null ? '' : String(body.productId)
  if (!productId) return NextResponse.json({ error: 'Choose a product.' }, { status: 400 })
  const checked = validatePriceTiers(Array.isArray(body.tiers) ? (body.tiers as unknown[]).map((t) => ({ ...(t as object), productId })) : body.tiers)
  if (checked.error) return NextResponse.json({ error: checked.error }, { status: 400 })
  await savePriceTiers(d1, productId, checked.tiers, now)
  return NextResponse.json({ tiers: await listPriceTiers(d1, [productId]) })
}
