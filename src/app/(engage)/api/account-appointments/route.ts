import { NextResponse } from 'next/server'

import { canSeeBookingsByEmail } from '@/features/accounts/access'
import { cancelError } from '@/features/bookings/service'
import * as store from '@/features/bookings/store'
import { getEngine } from '@/engine'
import { rawD1 } from '@/features/ecommerce/server/db'
import { clientKey, hit } from '@/features/security/rateLimit'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/**
 * POST { id, action: 'cancel' }: a signed-in customer cancels one of their own appointments before it starts.
 * Own means the booking's email is the account's confirmed email. Anything else answers "not found".
 */
export async function POST(request: Request): Promise<Response> {
  const flags = await getFeatureFlags()
  if (!flags.bookings || !flags.accounts) return json({ error: 'Not found' }, 404)
  const engine = (await getEngine()) as unknown as { auth: (a: unknown) => Promise<{ user?: { id?: number; email?: string | null; emailVerifiedAt?: string | null } | null }> }
  const auth = await engine.auth({ headers: request.headers }).catch((): { user: null } => ({ user: null }))
  const user = auth.user
  if (!user?.id || !user.email) return json({ error: 'Sign in to manage appointments.' }, 401)
  if (hit(`account-appointments:${clientKey(request)}`, 30).limited) return json({ error: 'Too many requests. Please wait a moment.' }, 429)
  const body = (await request.json().catch((): null => null)) as { id?: unknown; action?: unknown } | null
  const id = Number(body?.id)
  if (!body || body.action !== 'cancel' || !Number.isInteger(id) || id <= 0) return json({ error: 'Unknown action.' }, 400)
  if (!canSeeBookingsByEmail(user)) return json({ error: 'Confirm your email address first.' }, 403)
  const d1 = (await rawD1()) as never as store.D1
  const booking = await store.getBooking(d1, id).catch((): null => null)
  if (!booking || booking.customerEmail.trim().toLowerCase() !== user.email.trim().toLowerCase()) return json({ error: 'Not found' }, 404)
  const error = cancelError(booking, new Date())
  if (error) return json({ error }, 409)
  const { cancelWithRefund } = await import('@/features/bookings/payment')
  const outcome = await cancelWithRefund(d1, (await getEngine()) as never, booking)
  if (!outcome.cancelled) return json({ error: outcome.note }, 503)
  return json({ ok: true, status: 'cancelled', note: outcome.note })
}
