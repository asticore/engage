import { hashToken, isManageToken } from '@/features/bookings/logic'
import { bookingIcs } from '@/features/bookings/service'
import * as store from '@/features/bookings/store'
import { rawD1 } from '@/features/ecommerce/server/db'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

/** GET ?token=: the calendar file for one booking, found by its private link secret. */
export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token')
  if (!(await getFeatureFlags()).bookings || !isManageToken(token)) return new Response('Not found', { status: 404 })
  const d1 = (await rawD1()) as never as store.D1
  const booking = await store.getBookingByTokenHash(d1, await hashToken(token)).catch((): null => null)
  if (!booking || booking.status === 'cancelled') return new Response('Not found', { status: 404 })
  const type = await store.getType(d1, booking.typeId)
  const body = bookingIcs(booking, type?.title ?? 'Booking', type?.locationText ?? '', new URL(request.url).origin)
  return new Response(body, { headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': `attachment; filename="${booking.number}.ics"`, 'cache-control': 'private, no-store' } })
}
