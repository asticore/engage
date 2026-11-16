import { afterRefund, commissionBase, commissionCents, effectiveRate, eligibleAt, isSelfReferral } from './commission'
import { readRefCookie } from './core'
import * as store from './store'

/**
 * Order hooks for affiliates (Task 31b). Each one is best effort and gated on the Affiliates switch:
 * it never throws into checkout, a payment webhook or a refund. The tables exist only once the feature
 * has been switched on, so every call is wrapped.
 */

type Order = Record<string, unknown>

async function enabled(): Promise<boolean> {
  try {
    const { getFeatureFlags } = await import('@/utilities/features')
    return Boolean((await getFeatureFlags()).affiliates)
  } catch {
    return false
  }
}

async function db(): Promise<store.D1> {
  const { rawD1 } = await import('@/features/ecommerce/server/db')
  return (await rawD1()) as never as store.D1
}

/** A new order: remember which affiliate sent the buyer (from the eg_ref cookie), unless it is their own order. */
export async function affiliateOrderCreated(order: Order): Promise<void> {
  try {
    if (!(await enabled())) return
    const { headers } = await import('next/headers')
    const code = readRefCookie((await headers()).get('cookie'))
    if (!code) return
    const d1 = await db()
    const affiliate = await store.findActiveByCode(d1, code)
    if (!affiliate) return
    const full = await store.getAffiliateById(d1, affiliate.id)
    const buyer = String(order.customerEmail ?? '')
    if (isSelfReferral(full?.email, buyer)) return
    if ((await store.getSettings(d1)).firstOrderOnly && (await store.hasPriorOrderFrom(d1, affiliate.id, buyer))) return
    await store.insertTracked(d1, { affiliateId: affiliate.id, orderId: Number(order.id), customerEmail: buyer }, new Date().toISOString())
  } catch {
    // Attribution must never fail an order.
  }
}

/** The order was paid: work out the commission once and start its waiting period. Safe to call again. */
export async function affiliateOrderPaid(order: Order | null): Promise<void> {
  try {
    if (!order || !(await enabled())) return
    const d1 = await db()
    const row = await store.commissionForOrder(d1, Number(order.id))
    if (!row || row.status !== 'tracked') return
    const settings = await store.getSettings(d1)
    const base = commissionBase(order.subtotal, order.discountTotal)
    const now = new Date()
    const pct = effectiveRate((await store.getAffiliateById(d1, row.affiliate_id))?.ratePct, settings.commissionPct)
    await store.markCommissionPending(d1, { orderId: row.order_id, base, pct, amount: commissionCents(base, pct), eligibleAt: eligibleAt(now, settings.pendingDays) }, now.toISOString())
  } catch {
    // Commissions are retried the next time the order is marked paid.
  }
}

/** A refund was recorded: reduce the commission in proportion, or reverse it when the order is fully refunded. */
export async function affiliateOrderRefunded(order: Order | null): Promise<void> {
  try {
    if (!order || !(await enabled())) return
    const d1 = await db()
    const row = await store.commissionForOrder(d1, Number(order.id))
    // Nothing to reduce before payment, after a reversal, or once the money has been paid out (the admin recovers a paid commission by hand).
    if (!row || row.status !== 'pending') return
    const total = Number(order.amount) || 0
    const refunded = Number(order.refundedTotal) || 0
    const left = afterRefund(row.base_cents, row.rate_pct, refunded, total)
    await store.setCommissionAmount(d1, row.order_id, left, left === 0 ? 'reversed' : row.status, new Date().toISOString())
  } catch {
    // Best effort.
  }
}
