import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { stripeClient } from '@/features/members/billing'
import { afterRetry, stateOf } from '@/features/members/dunning'
import { endRun, retryInvoice } from '@/features/members/dunningRun'
import { getMemberSettings } from '@/features/members/settings'
import { MEMBERSHIPS_SLUG } from '@/features/members/slugs'
import type { MembershipDoc, MembershipTierDoc } from '@/features/members/types'
import { adminRequestRefusal } from '@/features/forms/origin'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function guard(request: Request, write: boolean): Promise<{ response: Response } | { engine: Awaited<ReturnType<typeof getAdminContext>>['engine'] }> {
  if (write) {
    const refusal = adminRequestRefusal(request)
    if (refusal) return { response: json({ error: refusal }, 403) }
  }
  const ctx = await getAdminContext()
  if (!ctx.user) return { response: json({ error: 'Unauthorised' }, 401) }
  if (!ctx.isAdmin) return { response: json({ error: 'Forbidden' }, 403) }
  if (!(await getFeatureFlags()).members) return { response: json({ error: 'Switch Members on in Site Settings first.' }, 409) }
  return { engine: ctx.engine }
}

const row = (m: MembershipDoc) => {
  const u = (m.user && typeof m.user === 'object' ? m.user : {}) as { email?: string; name?: string }
  const s = stateOf(m)
  return { id: Number(m.id), email: u.email ?? '', name: u.name ?? '', tier: m.tier && typeof m.tier === 'object' ? ((m.tier as MembershipTierDoc).name ?? '') : '', startedAt: s.startedAt, attempts: s.attempts, nextAt: s.nextAt, graceEndsAt: s.graceEndsAt, notes: m.notes ?? '' }
}

/** GET: members whose renewal payment failed, with where each is in the chase. Admin only. */
export async function GET(request: Request): Promise<Response> {
  const g = await guard(request, false)
  if ('response' in g) return g.response
  const { docs } = await (g.engine as never as { find: (a: Record<string, unknown>) => Promise<{ docs: unknown[] }> }).find({ collection: MEMBERSHIPS_SLUG, where: { status: { equals: 'past-due' } }, limit: 200, depth: 1, overrideAccess: true })
  return json({ members: (docs as MembershipDoc[]).map(row) })
}

/** POST { action: retry | end, id }: tries the card now, or ends the run now. Admin only. */
export async function POST(request: Request): Promise<Response> {
  const g = await guard(request, true)
  if ('response' in g) return g.response
  const body = (await request.json().catch((): null => null)) as { action?: unknown; id?: unknown } | null
  const id = Number(body?.id)
  if (!Number.isInteger(id) || id <= 0) return json({ error: 'Pick a member.' }, 400)
  const engine = g.engine as never as { findByID: (a: Record<string, unknown>) => Promise<unknown>; update: (a: Record<string, unknown>) => Promise<unknown> }
  const membership = (await engine.findByID({ collection: MEMBERSHIPS_SLUG, id, depth: 1, overrideAccess: true }).catch((): null => null)) as MembershipDoc | null
  if (!membership || membership.status !== 'past-due') return json({ error: 'That membership is not past due.' }, 404)
  const stripe = stripeClient()
  if (body?.action === 'end') {
    const result = await endRun(engine, membership, stripe)
    return json({ ok: true, result })
  }
  if (body?.action === 'retry') {
    if (!stripe || !membership.externalSubscriptionId) return json({ error: 'There is no Stripe subscription to retry.' }, 409)
    const paid = await retryInvoice(stripe, membership.externalSubscriptionId)
    const settings = await getMemberSettings(engine as never)
    if (!paid) await engine.update({ collection: MEMBERSHIPS_SLUG, id, data: { dunningAttempts: afterRetry(stateOf(membership), settings.billing).attempts }, overrideAccess: true })
    return json({ ok: true, paid })
  }
  return json({ error: 'Unknown action.' }, 400)
}
