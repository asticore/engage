import { approvedEmail, commissionEmail, payoutEmail } from './emails'
import { afterRefund, commissionForLines, eligibleAt, isSelfReferral, parseTiers, tierRate } from './commission'
import { normaliseCoupon, readRefCookie, readUtmCookie } from './core'
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
    const cookie = (await headers()).get('cookie')
    const d1 = await db()
    const code = readRefCookie(cookie)
    let affiliate = code ? await store.findActiveByCode(d1, code) : null
    let source: 'link' | 'coupon' = 'link'
    if (!affiliate) {
      // No link cookie (or its affiliate is not active): fall back to a coupon code that belongs to an affiliate.
      const lines = (Array.isArray(order.couponLines) ? order.couponLines : []) as { code?: string }[]
      for (const line of lines) {
        affiliate = await store.findActiveByCoupon(d1, normaliseCoupon(line.code))
        if (affiliate) break
      }
      source = 'coupon'
    }
    if (!affiliate) return
    const full = await store.getAffiliateById(d1, affiliate.id)
    const buyer = String(order.customerEmail ?? '')
    if (isSelfReferral(full?.email, buyer)) return
    if ((await store.getSettings(d1)).firstOrderOnly && (await store.hasPriorOrderFrom(d1, affiliate.id, buyer))) return
    await store.insertTracked(d1, { affiliateId: affiliate.id, orderId: Number(order.id), customerEmail: buyer, source, utm: source === 'link' ? readUtmCookie(cookie) : undefined }, new Date().toISOString())
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
    const now = new Date()
    const defaultPct = tierRate(parseTiers(settings.tiers), await store.lifetimeSalesCents(d1, row.affiliate_id), settings.commissionPct)
    const { base, amount, pct } = commissionForLines(order.lineItems as never, order.subtotal, order.discountTotal, { override: (await store.getAffiliateById(d1, row.affiliate_id))?.ratePct, productRates: await store.getProductRates(d1), defaultPct })
    const eligible = eligibleAt(now, settings.pendingDays)
    const started = await store.markCommissionPending(d1, { orderId: row.order_id, base, pct, amount, eligibleAt: eligible }, now.toISOString())
    if (started && amount > 0) await sendAffiliateEmail('commission', row.affiliate_id, { orderId: row.order_id, amountCents: amount, payableOn: eligible })
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

type EmailExtra = { amountCents?: number; note?: string; orderId?: number; payableOn?: string }

/**
 * Emails an affiliate (approved, commission earned, payout recorded) when the Email switch on the Affiliates screen is on
 * and they have an address. Best effort: it never throws into the action that caused it.
 */
export async function sendAffiliateEmail(kind: 'approved' | 'commission' | 'payout', affiliateId: number, extra: EmailExtra): Promise<void> {
  try {
    const d1 = await db()
    const settings = await store.getSettings(d1)
    if (!settings.emailNotifications) return
    const a = await store.getAffiliateById(d1, affiliateId)
    if (!a || !a.email) return
    const { configuredSiteOrigin } = await import('@/utilities/siteOrigin')
    const origin = configuredSiteOrigin().replace(/\/+$/, '')
    if (!origin) return
    const dashboard = a.token ? `${origin}/affiliates/dashboard?token=${a.token}` : `${origin}/affiliates`
    const mail =
      kind === 'approved'
        ? approvedEmail({ name: a.name, link: `${origin}/?ref=${encodeURIComponent(a.code)}`, dashboard, commissionPct: a.ratePct ?? settings.commissionPct, cookieDays: settings.cookieDays })
        : kind === 'commission'
          ? commissionEmail({ name: a.name, orderId: extra.orderId ?? 0, amountCents: extra.amountCents ?? 0, payableOn: extra.payableOn ?? '', dashboard })
          : payoutEmail({ name: a.name, amountCents: extra.amountCents ?? 0, note: extra.note ?? '', dashboard })
    const { sendEmail } = await import('@/features/email')
    await sendEmail({ to: a.email, subject: mail.subject, text: mail.text, template: `affiliate.${kind}` })
  } catch {
    // An email problem never blocks approving, paying or an order.
  }
}
