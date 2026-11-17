import { NextResponse } from 'next/server'

import { canSeeBookingsByEmail } from '@/features/accounts/access'
import { getEngine } from '@/engine'
import { rawD1 } from '@/features/ecommerce/server/db'
import { hashToken, newQuoteToken, portalCanOpen } from '@/features/quotes/logic'
import * as store from '@/features/quotes/store'
import { clientKey, hit } from '@/features/security/rateLimit'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/**
 * POST { id }: a signed-in customer opens one of their own quotes from the account page. Own means the request's email is
 * the account's confirmed email; anything else answers "not found". The private link is only stored as a hash, so this
 * makes a new one (the link in the earlier email stops working) and answers { url }.
 */
export async function POST(request: Request): Promise<Response> {
  const flags = await getFeatureFlags()
  if (!flags.quotes || !flags.accounts) return json({ error: 'Not found' }, 404)
  const engine = (await getEngine()) as unknown as { auth: (a: unknown) => Promise<{ user?: { id?: number; email?: string | null; emailVerifiedAt?: string | null } | null }> }
  const auth = await engine.auth({ headers: request.headers }).catch((): { user: null } => ({ user: null }))
  const user = auth.user
  if (!user?.id || !user.email) return json({ error: 'Sign in to see your quotes.' }, 401)
  if (hit(`account-quote-link:${clientKey(request)}`, 20).limited) return json({ error: 'Too many requests. Please wait a moment.' }, 429)
  const body = (await request.json().catch((): null => null)) as { id?: unknown } | null
  const id = Number(body?.id)
  if (!Number.isInteger(id) || id <= 0) return json({ error: 'Unknown request.' }, 400)
  if (!canSeeBookingsByEmail(user)) return json({ error: 'Confirm your email address first.' }, 403)
  const d1 = (await rawD1()) as never as store.D1
  const found = await store.getRequest(d1, id).catch((): null => null)
  if (!found || found.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) return json({ error: 'Not found' }, 404)
  const now = new Date()
  if (!portalCanOpen(found, now)) return json({ error: 'This quote is no longer open.' }, 409)
  const token = newQuoteToken()
  const iso = now.toISOString()
  if (!(await store.setTokenHash(d1, id, await hashToken(token), iso))) return json({ error: 'Not found' }, 404)
  await store.addActivity(d1, id, 'customer', 'Opened the quote from their account.', iso).catch((): void => undefined)
  return json({ url: `/quote/${token}` })
}
