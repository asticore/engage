import { NextResponse } from 'next/server'

import { confirmationEmail, createForType } from '@/features/bookings/service'
import { parseCustomer } from '@/features/bookings/logic'
import * as store from '@/features/bookings/store'
import { rawD1 } from '@/features/ecommerce/server/db'
import { sendEmail } from '@/features/email'
import { hitShared } from '@/features/security/rateLimit'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/**
 * POST { type, start, name, email, phone?, notes? }: books one time. The time must be one the booking type offers
 * right now, and two people asking for the last place cannot both get it. Sends the confirmation with a private link.
 */
export async function POST(request: Request): Promise<Response> {
  if (!(await getFeatureFlags()).bookings) return json({ error: 'Not found' }, 404)
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || 'unknown'
  if ((await hitShared(`booking-create:${ip}`, 10)).limited) return json({ error: 'Too many bookings from this connection. Try again later.' }, 429)
  const body = (await request.json().catch((): null => null)) as { type?: unknown; start?: unknown } & Record<string, unknown> | null
  if (!body) return json({ error: 'Send the booking details.' }, 400)
  const customer = parseCustomer(body)
  if (customer.ok === false) return json({ error: customer.error }, 400)
  const d1 = (await rawD1()) as never as store.D1
  const type = await store.getTypeBySlug(d1, String(body.type ?? '')).catch((): null => null)
  if (!type) return json({ error: 'Not found' }, 404)
  const result = await createForType(d1, type, String(body.start ?? ''), customer.value, new Date())
  if (result.ok === false) return json({ error: result.error }, result.status)
  const origin = new URL(request.url).origin
  if (result.booking.status === 'pending_payment') {
    // A priced booking holds its time while the customer pays on Stripe's page; the webhook confirms it and sends the email.
    try {
      const { getEngine } = await import('@/lib/engine')
      const { createBookingCheckout } = await import('@/features/bookings/payment')
      const payUrl = await createBookingCheckout((await getEngine()) as never, result.booking, type.title, result.token, origin)
      if (payUrl) return json({ ok: true, number: result.booking.number, payUrl, manageUrl: `${origin}/book/manage/${result.token}`, start: result.booking.startAt })
    } catch {
      // Fall through: release the time below.
    }
    await store.setBookingStatus(d1, result.booking.id, 'cancelled', new Date().toISOString())
    return json({ error: 'Card payment is not available right now. Please try again later or contact us.' }, 503)
  }
  try {
    const { getEngine } = await import('@/lib/engine')
    const site = (await ((await getEngine()) as never as { findGlobal: (a: unknown) => Promise<{ siteName?: string }> }).findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }).catch((): { siteName?: string } => ({}))) ?? {}
    const mail = confirmationEmail(result.booking, type.title, origin, result.token, site.siteName || 'Our team')
    await sendEmail({ to: result.booking.customerEmail, template: 'booking.confirmed', ...mail })
  } catch {
    // The booking is saved; a mail failure must not tell the customer it was not.
  }
  return json({ ok: true, number: result.booking.number, manageUrl: `${origin}/book/manage/${result.token}`, start: result.booking.startAt })
}
