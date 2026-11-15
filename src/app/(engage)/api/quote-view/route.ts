import { NextResponse } from 'next/server'

import { rawD1 } from '@/features/ecommerce/server/db'
import { effectiveStatus, hashToken, isQuoteToken, parseCounter } from '@/features/quotes/logic'
import { acceptQuote, getEngineSafe, sendQuoteEmail } from '@/features/quotes/service'
import * as store from '@/features/quotes/store'
import { hitShared } from '@/features/security/rateLimit'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function load(request: Request, token: unknown) {
  if (!(await getFeatureFlags()).quotes) return { response: json({ error: 'Not found' }, 404) }
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || 'unknown'
  if ((await hitShared(`quote-view:${ip}`, 30)).limited) return { response: json({ error: 'Too many requests. Try again in a minute.' }, 429) }
  if (!isQuoteToken(token)) return { response: json({ error: 'Not found' }, 404) }
  const d1 = (await rawD1()) as never as store.D1
  const found = await store.getByTokenHash(d1, await hashToken(token)).catch((): null => null)
  if (!found) return { response: json({ error: 'Not found' }, 404) }
  return { d1, found }
}

const view = (r: store.QuoteRequest, now: Date) => {
  const status = effectiveStatus(r.status, r.validUntil, now)
  return { number: r.number, kind: r.kind, status, name: r.name, currency: r.currency, lines: r.lines, totalCents: r.totalCents, validUntil: r.validUntil, terms: r.terms, counterNote: r.counterNote, counterCents: r.counterCents, answerable: status === 'quoted' }
}

/** GET ?token=: the quote behind a private link. POST { token, action: accept | decline | counter, note?, amount? }. */
export async function GET(request: Request): Promise<Response> {
  const l = await load(request, new URL(request.url).searchParams.get('token'))
  if (!l.found) return l.response!
  return json(view(l.found, new Date()))
}

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  const l = await load(request, body?.token)
  if (!l.found) return l.response!
  const now = new Date()
  const iso = now.toISOString()
  const engine = await getEngineSafe()
  const current = l.found
  if (effectiveStatus(current.status, current.validUntil, now) === 'expired') return json({ error: 'This quote has expired. Ask us for a new one.' }, 409)
  switch (body?.action) {
    case 'accept': {
      const result = await acceptQuote(l.d1, engine, current, now)
      if (result.ok === false) return json({ error: result.error }, result.status)
      break
    }
    case 'decline': {
      if (!(await store.moveStatus(l.d1, current.id, 'declined', ['quoted', 'countered'], iso))) return json({ error: 'This quote was already answered.' }, 409)
      await store.addActivity(l.d1, current.id, 'customer', 'Declined.', iso)
      await sendQuoteEmail(engine, 'declined', current, { to: 'admin' })
      break
    }
    case 'counter': {
      const parsed = parseCounter(body)
      if (parsed.ok === false) return json({ error: parsed.error }, 400)
      if (!(await store.setCounter(l.d1, current.id, parsed.value.note, parsed.value.cents, iso))) return json({ error: 'This quote was already answered.' }, 409)
      await store.addActivity(l.d1, current.id, 'customer', 'Sent a counter-offer.', iso)
      await sendQuoteEmail(engine, 'counter', { ...current, counterNote: parsed.value.note, counterCents: parsed.value.cents }, { to: 'admin' })
      break
    }
    default:
      return json({ error: 'Unknown action.' }, 400)
  }
  const fresh = (await store.getRequest(l.d1, current.id)) ?? current
  return json(view(fresh, new Date()))
}
