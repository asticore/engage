import { NextResponse } from 'next/server'

import { hashToken, isManageToken } from '@/features/bookings/logic'
import { cancelError } from '@/features/bookings/service'
import * as store from '@/features/bookings/store'
import { rawD1 } from '@/features/ecommerce/server/db'
import { hitShared } from '@/features/security/rateLimit'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function load(request: Request, token: unknown) {
  if (!(await getFeatureFlags()).bookings) return { response: json({ error: 'Not found' }, 404) }
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || 'unknown'
  if ((await hitShared(`booking-manage:${ip}`, 30)).limited) return { response: json({ error: 'Too many requests. Try again in a minute.' }, 429) }
  if (!isManageToken(token)) return { response: json({ error: 'Not found' }, 404) }
  const d1 = (await rawD1()) as never as store.D1
  const booking = await store.getBookingByTokenHash(d1, await hashToken(token)).catch((): null => null)
  if (!booking) return { response: json({ error: 'Not found' }, 404) }
  return { d1, booking }
}

const view = async (d1: store.D1, b: store.Booking) => ({ number: b.number, status: b.status, start: b.startAt, end: b.endAt, timeZone: b.timeZone, typeTitle: (await store.getType(d1, b.typeId))?.title ?? 'Booking', customerName: b.customerName, cancellable: cancelError(b, new Date()) === null })

/** GET ?token=: the booking behind a private link. POST { token, action: 'cancel' }: cancels it, before it starts. */
export async function GET(request: Request): Promise<Response> {
  const found = await load(request, new URL(request.url).searchParams.get('token'))
  if (!found.booking) return found.response!
  return json(await view(found.d1, found.booking))
}

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch((): null => null)) as { token?: unknown; action?: unknown } | null
  const found = await load(request, body?.token)
  if (!found.booking) return found.response!
  if (body?.action !== 'cancel') return json({ error: 'Unknown action.' }, 400)
  const error = cancelError(found.booking, new Date())
  if (error) return json({ error }, 409)
  const { getEngine } = await import('@/lib/engine')
  const { cancelWithRefund } = await import('@/features/bookings/payment')
  const outcome = await cancelWithRefund(found.d1, (await getEngine()) as never, found.booking)
  if (!outcome.cancelled) return json({ error: outcome.note }, 503)
  return json({ ...(await view(found.d1, { ...found.booking, status: 'cancelled' })), note: outcome.note })
}
