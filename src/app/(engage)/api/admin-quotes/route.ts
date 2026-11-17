import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { deleteQuoteFiles, getQuoteBucket } from '@/features/quotes/attachments'
import { rawD1 } from '@/features/ecommerce/server/db'
import { adminRequestRefusal } from '@/features/forms/origin'
import { hashToken, isQuoteStatus, newQuoteToken, parseQuote, totalCents } from '@/features/quotes/logic'
import { getEngineSafe, sendQuoteEmail } from '@/features/quotes/service'
import * as store from '@/features/quotes/store'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function guard(request: Request, write: boolean): Promise<Response | null> {
  if (write) {
    const refusal = adminRequestRefusal(request)
    if (refusal) return json({ error: refusal }, 403)
  }
  const ctx = await getAdminContext()
  if (!ctx.user) return json({ error: 'Unauthorised' }, 401)
  if (!ctx.isAdmin) return json({ error: 'Forbidden' }, 403)
  if (!(await getFeatureFlags()).quotes) return json({ error: 'Switch Quotes and requests on in Site Settings first.' }, 409)
  return null
}

/** GET ?status=: requests, newest first. Quotes past their date are closed first. Admin only. */
export async function GET(request: Request): Promise<Response> {
  const denied = await guard(request, false)
  if (denied) return denied
  const d1 = (await rawD1()) as never as store.D1
  await store.expireOverdue(d1, new Date().toISOString()).catch((): number => 0)
  const status = new URL(request.url).searchParams.get('status')
  return json({ requests: await store.listRequests(d1, { status: isQuoteStatus(status) ? status : undefined }) })
}

/** POST { action, id, ... }: sendQuote (lines, validDays, terms, message), setStatus (declined or closed), delete. Admin only. */
export async function POST(request: Request): Promise<Response> {
  const denied = await guard(request, true)
  if (denied) return denied
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'Send the details.' }, 400)
  const id = Number(body.id)
  if (!Number.isInteger(id) || id <= 0) return json({ error: 'Pick a request.' }, 400)
  const d1 = (await rawD1()) as never as store.D1
  const current = await store.getRequest(d1, id)
  if (!current) return json({ error: 'Request not found.' }, 404)
  const now = new Date()
  const iso = now.toISOString()
  switch (body.action) {
    case 'sendQuote': {
      const parsed = parseQuote(body, now)
      if (parsed.ok === false) return json({ error: parsed.error }, 400)
      const token = newQuoteToken()
      const total = totalCents(parsed.value.lines)
      const saved = await store.saveQuote(d1, id, { lines: parsed.value.lines, totalCents: total, validUntil: parsed.value.validUntil, terms: parsed.value.terms, tokenHash: await hashToken(token) }, iso)
      if (!saved) return json({ error: 'This request has already been accepted or closed.' }, 409)
      await store.addActivity(d1, id, 'staff', 'Quote sent.', iso)
      const fresh = (await store.getRequest(d1, id)) ?? current
      await sendQuoteEmail(await getEngineSafe(), 'quote', fresh, { to: 'customer', origin: new URL(request.url).origin, token, message: parsed.value.message })
      return json({ ok: true })
    }
    case 'setStatus': {
      if (body.status !== 'closed' && body.status !== 'declined') return json({ error: 'Pick closed or declined.' }, 400)
      if (!(await store.moveStatus(d1, id, body.status, ['new', 'quoted', 'countered', 'expired'], iso))) return json({ error: 'This request cannot be changed now.' }, 409)
      await store.addActivity(d1, id, 'staff', body.status === 'closed' ? 'Closed.' : 'Declined.', iso)
      return json({ ok: true })
    }
    case 'delete':
      await deleteQuoteFiles(await getQuoteBucket(), current.number).catch((): number => 0)
      await store.deleteRequest(d1, id)
      return json({ ok: true })
    default:
      return json({ error: 'Unknown action.' }, 400)
  }
}
