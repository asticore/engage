import { NextResponse } from 'next/server'

import { rawD1 } from '@/features/ecommerce/server/db'
import { parseRequest, newQuoteNumber } from '@/features/quotes/logic'
import { getEngineSafe, sendQuoteEmail } from '@/features/quotes/service'
import * as store from '@/features/quotes/store'
import { loadShopCurrency } from '@/features/ecommerce/lib/shopCurrency'
import { hitShared } from '@/features/security/rateLimit'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/** POST { kind, name, email, phone?, quantity?, details?, deadline?, offer?, productId?, pageUrl? }: saves a request and tells the customer and the shop. */
export async function POST(request: Request): Promise<Response> {
  if (!(await getFeatureFlags()).quotes) return json({ error: 'Not found' }, 404)
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || 'unknown'
  if ((await hitShared(`quote-request:${ip}`, 8)).limited) return json({ error: 'Too many requests from this connection. Try again later.' }, 429)
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'Send the details.' }, 400)
  if (typeof body.website === 'string' && body.website) return json({ ok: true }) // a hidden field only bots fill in
  const parsed = parseRequest(body)
  if (parsed.ok === false) return json({ error: parsed.error }, 400)
  const d1 = (await rawD1()) as never as store.D1
  const engine = await getEngineSafe()
  const currency = await loadShopCurrency(engine as never).catch(() => 'AUD')
  const saved = await store.createRequest(d1, newQuoteNumber(), parsed.value, currency, new Date().toISOString())
  if (!saved) return json({ error: 'We could not save that. Please try again.' }, 500)
  await sendQuoteEmail(engine, 'received', saved, { to: 'customer' })
  await sendQuoteEmail(engine, 'adminNew', saved, { to: 'admin' })
  return json({ ok: true, number: saved.number })
}
