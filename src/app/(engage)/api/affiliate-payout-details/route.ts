import { NextResponse } from 'next/server'

import { isToken } from '@/features/affiliates/core'
import { findByToken, setPayoutDetails, type D1 } from '@/features/affiliates/store'
import { rawD1 } from '@/features/ecommerce/server/db'
import { clientKey, hit } from '@/features/security/rateLimit'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

/** POST { token, details }: an affiliate saves how they want to be paid (for example a PayPal email). Plain text, 300 characters. */
export async function POST(request: Request): Promise<Response> {
  const reply = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
  if (!(await getFeatureFlags()).affiliates) return reply({ error: 'Affiliates are not switched on.' }, 404)
  if (hit(`affiliate-payout-details:${clientKey(request)}`, 10).limited) return reply({ error: 'Too many attempts. Try again in a little while.' }, 429)
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body || !isToken(body.token)) return reply({ error: 'Invalid request.' }, 400)
  const d1 = (await rawD1()) as never as D1
  const affiliate = await findByToken(d1, body.token)
  if (!affiliate) return reply({ error: 'Invalid request.' }, 404)
  const details = typeof body.details === 'string' ? body.details.replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, 300) : ''
  await setPayoutDetails(d1, affiliate.id, details, new Date().toISOString())
  return reply({ ok: true })
}
