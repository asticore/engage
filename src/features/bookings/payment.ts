import type Stripe from 'stripe'

import { formatMoney } from '@/features/ecommerce/lib/money'
import { loadShopCurrency } from '@/features/ecommerce/lib/shopCurrency'
import { loadPaymentSettings, resolveStripeSecret } from '@/features/ecommerce/payments/config'
import { getStripeClient } from '@/features/ecommerce/payments/stripeAdapter'

import { HOLD_MINUTES, holdActive, refundCentsFor } from './logic'
import { confirmationEmail } from './service'
import * as store from './store'

/**
 * Paid bookings. A booking on a priced type starts as pending_payment and holds its time for HOLD_MINUTES while the
 * customer pays on Stripe's page. The payment_intent.succeeded webhook confirms it (metadata.bookingId); a payment that
 * lands after the hold ran out is refunded in full. A customer cancelling a paid booking gets the whole payment back
 * when the cancel is far enough ahead (the type's refund window), otherwise nothing.
 */

type Engine = { findGlobal: (a: unknown) => Promise<Record<string, unknown> | null>; find: (a: unknown) => Promise<{ docs: Record<string, unknown>[] }> }

/** The Stripe client for the shop, or null while card payments are not set up. */
async function stripeFor(engine: Engine): Promise<Stripe | null> {
  const settings = await loadPaymentSettings(engine as never)
  const key = resolveStripeSecret(settings)
  return key ? getStripeClient(key) : null
}

/** A Stripe Checkout Session for one unpaid booking. Returns the page address, or null when cards are not set up. */
export async function createBookingCheckout(engine: Engine, booking: store.Booking, typeTitle: string, token: string, origin: string): Promise<string | null> {
  const stripe = await stripeFor(engine)
  if (!stripe) return null
  const currency = (await loadShopCurrency(engine as never)).toLowerCase()
  const meta = { bookingId: String(booking.id), bookingToken: token }
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: booking.customerEmail,
    line_items: [{ quantity: 1, price_data: { currency, unit_amount: booking.amountCents, product_data: { name: `${typeTitle} (${booking.number})`.slice(0, 250) } } }],
    payment_intent_data: { metadata: meta },
    metadata: meta,
    expires_at: Math.floor(Date.now() / 1000) + HOLD_MINUTES * 60 + 60,
    success_url: `${origin}/book/manage/${token}?paid=1`,
    cancel_url: `${origin}/book/manage/${token}`,
  })
  return session.url ?? null
}

export type PaidResult = 'confirmed' | 'refunded-late' | 'already' | 'unknown'

/**
 * The webhook side. Confirms the booking and sends the confirmation email (the private link comes from the intent's
 * metadata, because only a hash of it is stored). Safe to replay.
 */
export async function onBookingPaid(d1: store.D1, engine: Engine, intent: Pick<Stripe.PaymentIntent, 'id' | 'amount_received' | 'metadata'>, origin: string, now = new Date()): Promise<PaidResult> {
  const id = Number(intent.metadata?.bookingId)
  if (!Number.isInteger(id) || id <= 0) return 'unknown'
  const booking = await store.getBooking(d1, id)
  if (!booking) return 'unknown'
  if (booking.status !== 'pending_payment') {
    if (booking.paymentIntentId === intent.id) return 'already'
    // Paid after the hold was released: give the money back.
    const stripe = await stripeFor(engine)
    if (stripe && booking.paymentIntentId === null && booking.refundedCents === 0) {
      await stripe.refunds.create({ payment_intent: intent.id })
      await store.setRefunded(d1, id, intent.amount_received, now.toISOString())
    }
    return 'refunded-late'
  }
  if (!(await store.markPaid(d1, id, intent.id, now.toISOString()))) return 'already'
  try {
    const type = await store.getType(d1, booking.typeId)
    const site = (await engine.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }).catch((): null => null)) as { siteName?: string } | null
    const token = String(intent.metadata?.bookingToken ?? '')
    const mail = confirmationEmail({ ...booking, status: 'confirmed' }, type?.title ?? 'Your booking', origin, token, site?.siteName || 'Our team')
    const { sendEmail } = await import('@/features/email')
    await sendEmail({ to: booking.customerEmail, template: 'booking.confirmed', ...mail })
  } catch {
    // The booking is confirmed; a mail failure must not fail the webhook.
  }
  return 'confirmed'
}

/**
 * Cancels a booking and refunds by the type's policy. Returns what happened for the customer to read. A booking still
 * waiting for payment is just released. The caller has already checked who may cancel and that it has not started.
 */
export async function cancelWithRefund(d1: store.D1, engine: Engine, booking: store.Booking, now = new Date()): Promise<{ cancelled: boolean; refundedCents: number; note: string }> {
  const type = await store.getType(d1, booking.typeId)
  let refunded = 0
  let note = ''
  if (booking.paymentIntentId && booking.amountCents > 0) {
    refunded = refundCentsFor({ amountCents: booking.amountCents, refundedCents: booking.refundedCents, refundHours: type?.refundHours ?? 24, startMs: booking.startMs, now })
    if (refunded > 0) {
      const stripe = await stripeFor(engine)
      if (!stripe) return { cancelled: false, refundedCents: 0, note: 'We could not reach the payment provider to refund this. Nothing was cancelled. Please try again or contact us.' }
      await stripe.refunds.create({ payment_intent: booking.paymentIntentId, amount: refunded })
      await store.setRefunded(d1, booking.id, booking.refundedCents + refunded, now.toISOString())
      note = `${formatMoney(refunded, (await loadShopCurrency(engine as never)) || 'AUD')} will be refunded to your card.`
    } else {
      note = `This was cancelled less than ${type?.refundHours ?? 24} hours before the start, so it is not refunded.`
    }
  }
  await store.setBookingStatus(d1, booking.id, 'cancelled', now.toISOString())
  return { cancelled: true, refundedCents: refunded, note }
}

/** Cron: releases the time of unpaid bookings whose hold ran out. Returns how many. */
export async function releaseExpiredHolds(d1: store.D1, now: Date): Promise<number> {
  let released = 0
  try {
    for (const booking of await store.pendingPayment(d1)) {
      if (booking.createdAtMs > 0 && holdActive(booking.createdAtMs, now)) continue
      await store.setBookingStatus(d1, booking.id, 'cancelled', now.toISOString())
      released += 1
    }
  } catch {
    // Bookings not set up yet.
  }
  return released
}
