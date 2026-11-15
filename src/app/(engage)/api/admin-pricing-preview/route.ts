import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { adminRequestRefusal } from '@/features/forms/origin'
import { customerTypesForUser } from '@/features/ecommerce/server/customerTypes'
import { customerStatsForEmail } from '@/features/ecommerce/server/customerStats'
import { priceCart } from '@/features/ecommerce/server/pricing'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/**
 * POST { email?, country?, lines: [{ product, quantity }] }: what that customer would be charged, worked out by the
 * same function the real checkout uses, so the preview matches the cart. Nothing is saved or sent. Admin only.
 */
export async function POST(request: Request): Promise<Response> {
  const refusal = adminRequestRefusal(request)
  if (refusal) return json({ error: refusal }, 403)
  const ctx = await getAdminContext()
  if (!ctx.user) return json({ error: 'Unauthorised' }, 401)
  if (!ctx.isAdmin) return json({ error: 'Forbidden' }, 403)
  const body = (await request.json().catch((): null => null)) as { email?: unknown; country?: unknown; lines?: unknown } | null
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const country = typeof body?.country === 'string' ? body.country.trim().toUpperCase().slice(0, 2) : ''
  const rows = Array.isArray(body?.lines) ? (body.lines as { product?: unknown; quantity?: unknown }[]) : []
  const items = rows
    .map((r) => ({ product: Number(r.product), quantity: Math.floor(Number(r.quantity)) }))
    .filter((r) => Number.isInteger(r.product) && r.product > 0 && r.quantity >= 1 && r.quantity <= 999)
    .slice(0, 30)
  if (items.length === 0) return json({ error: 'Add at least one product and quantity.' }, 400)

  const engine = ctx.engine as never as { find: (a: unknown) => Promise<{ docs: { id: number; roles?: unknown }[] }> }
  let customer: { id: number; roles?: unknown } | null = null
  if (email) {
    const found = await engine.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true }).catch((): { docs: { id: number; roles?: unknown }[] } => ({ docs: [] }))
    customer = found.docs[0] ?? null
  }
  const customerRoles = await customerTypesForUser(customer)
  try {
    const { totals } = await priceCart(ctx.engine as never, { items, address: { country }, email: email || null, customerRoles })
    const stats = await customerStatsForEmail(email)
    return json({
      customerFound: Boolean(customer),
      customerTypes: customerRoles,
      stats,
      lines: totals.lines.map((l) => ({ name: l.name, quantity: l.quantity, unitCents: l.unitCents, lineCents: l.lineCents, discountCents: l.discountCents })),
      subtotalCents: totals.subtotalCents,
      rules: totals.pricingRules,
      pricingRuleCents: totals.pricingRuleCents,
      totalCents: totals.totalCents,
    })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not price that cart.' }, 400)
  }
}
