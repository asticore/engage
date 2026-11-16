import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { balances, clampDays, clampPct } from '@/features/affiliates/commission'
import { MAX_AFFILIATES, STATUSES, normaliseCode, suggestCode, type AffiliateStatus } from '@/features/affiliates/core'
import * as store from '@/features/affiliates/store'
import { rawD1 } from '@/features/ecommerce/server/db'
import { adminRequestRefusal } from '@/features/forms/origin'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function guard(request: Request, write: boolean) {
  if (write) {
    const refusal = adminRequestRefusal(request)
    if (refusal) return { response: json({ error: refusal }, 403) }
  }
  const context = await getAdminContext()
  if (!context.user) return { response: json({ error: 'Please sign in again.' }, 401) }
  if (!context.isAdmin) return { response: json({ error: 'Only an admin can manage affiliates.' }, 403) }
  if (!(await getFeatureFlags()).affiliates) return { response: json({ error: 'Switch Affiliates on in Site Settings first.' }, 409) }
  return { context }
}

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** GET: every affiliate with its visit count. */
export async function GET(request: Request): Promise<Response> {
  const g = await guard(request, false)
  if (!g.context) return g.response
  const d1 = (await rawD1()) as never as store.D1
  const [affiliates, settings, rows, commissions, payouts] = await Promise.all([store.listAffiliates(d1), store.getSettings(d1), store.allCommissionRows(d1), store.commissionsFor(d1, null, 50), store.payoutsFor(d1, 50)])
  const now = new Date()
  const withBalances = affiliates.map((a) => ({ ...a, ...balances(rows.filter((r) => r.affiliate_id === a.id), now) }))
  return json({ affiliates: withBalances, settings, commissions, payouts })
}

/**
 * POST { action: 'create', name, email?, code?, status? } | { action: 'status', id, status } | { action: 'delete', id }
 */
export async function POST(request: Request): Promise<Response> {
  const g = await guard(request, true)
  if (!g.context) return g.response
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'Invalid request.' }, 400)
  const d1 = (await rawD1()) as never as store.D1
  const now = new Date().toISOString()

  if (body.action === 'create') {
    const name = text(body.name, 80)
    if (!name) return json({ error: 'Give the affiliate a name.' }, 400)
    if ((await store.countAffiliates(d1)) >= MAX_AFFILIATES) return json({ error: `A site can have at most ${MAX_AFFILIATES} affiliates.` }, 400)
    const wanted = text(body.code, 40)
    const code = wanted ? normaliseCode(wanted) : suggestCode(name)
    if (!code) return json({ error: 'A code is 3 to 32 letters, numbers or dashes.' }, 400)
    if (await store.codeTaken(d1, code)) return json({ error: 'That code is already used.' }, 409)
    const status: AffiliateStatus = STATUSES.includes(body.status as AffiliateStatus) ? (body.status as AffiliateStatus) : 'active'
    const id = await store.createAffiliate(d1, { code, name, email: text(body.email, 200), status }, now)
    return json({ ok: true, id, code })
  }
  if (body.action === 'settings') {
    const s = body.settings as Record<string, unknown> | undefined
    await store.saveSettings(d1, { cookieDays: clampDays(s?.cookieDays, 30, 365) || 30, clickRule: s?.clickRule === 'first' ? 'first' : 'last', commissionPct: clampPct(s?.commissionPct, 10), pendingDays: clampDays(s?.pendingDays, 30, 365) }, now)
    return json({ ok: true })
  }
  const id = Number(body.id)
  if (!Number.isInteger(id) || id < 1) return json({ error: 'Invalid affiliate.' }, 400)
  if (body.action === 'status') {
    if (!STATUSES.includes(body.status as AffiliateStatus)) return json({ error: 'Invalid status.' }, 400)
    await store.setAffiliateStatus(d1, id, body.status as AffiliateStatus, now)
    return json({ ok: true })
  }
  if (body.action === 'payout') {
    const paid = await store.recordPayout(d1, id, text(body.note, 200), now)
    return paid ? json({ ok: true, amountCents: paid.amount }) : json({ error: 'Nothing is due for this affiliate yet.' }, 400)
  }
  if (body.action === 'delete') {
    if (await store.hasCommissions(d1, id)) return json({ error: 'This affiliate has commissions on record. Suspend them instead of deleting.' }, 409)
    await store.deleteAffiliate(d1, id)
    return json({ ok: true })
  }
  return json({ error: 'Unknown action.' }, 400)
}
