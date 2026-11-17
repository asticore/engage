/**
 * Card fingerprint capture for purchase limits. Stripe gives every card an opaque fingerprint (the same card always has
 * the same one; it is not the card number). Saving it against a paid order lets a limit see one person behind several
 * emails and addresses. Best effort: it never throws and never touches the payment.
 */

import type Stripe from 'stripe'

/** The card fingerprint on a charge, or '' when the payment was not by card. */
export function fingerprintOf(charge: unknown): string {
  const details = (charge as { payment_method_details?: { card?: { fingerprint?: unknown } } } | null)?.payment_method_details
  const value = details?.card?.fingerprint
  return typeof value === 'string' ? value.trim() : ''
}

/** Looks the paid intent's charge up on Stripe and saves its card fingerprint against the order (when Purchase limits is on). */
export async function recordOrderCardPrint(orderId: number, intentId: string, secretKey: string | null): Promise<void> {
  try {
    const { getFeatureFlags } = await import('@/utilities/features')
    if (!secretKey || !(await getFeatureFlags()).limits) return
    const { getStripeClient } = await import('@/features/ecommerce/payments/stripeAdapter')
    const intent = (await getStripeClient(secretKey).paymentIntents.retrieve(intentId, { expand: ['latest_charge'] })) as Stripe.PaymentIntent
    const fingerprint = fingerprintOf(intent.latest_charge)
    if (!fingerprint) return
    const { rawD1 } = await import('@/features/ecommerce/server/db')
    const store = await import('./store')
    await store.recordCardPrint((await rawD1()) as never, orderId, fingerprint, new Date().toISOString())
  } catch {
    /* the limit simply has no card to match */
  }
}
