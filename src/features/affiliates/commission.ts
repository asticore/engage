/**
 * Commission maths and rules (Task 31b), pure. Money is whole cents. One commission per order. It is
 * worked out when the order is paid (on the subtotal after discounts, before shipping and tax), waits
 * out a pending period, and is reduced or reversed by refunds. Payouts are recorded by hand.
 */

export type CommissionStatus = 'tracked' | 'pending' | 'paid' | 'reversed'

export const clampPct = (value: unknown, fallback = 10): number => {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) / 100 : fallback
}
export const clampDays = (value: unknown, fallback: number, max = 365): number => {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) && n >= 0 && n <= max ? n : fallback
}

/** The amount the commission is worked on: subtotal minus discounts, never below zero. */
export const commissionBase = (subtotalCents: unknown, discountCents: unknown): number => Math.max(0, Math.round(Number(subtotalCents) || 0) - Math.round(Number(discountCents) || 0))

export const commissionCents = (baseCents: number, pct: number): number => Math.max(0, Math.round((baseCents * pct) / 100))

/** The commission left after refunds: reduced in proportion to the refunded share of the order total. */
export function afterRefund(baseCents: number, pct: number, refundedCents: number, orderTotalCents: number): number {
  if (orderTotalCents <= 0) return 0
  const kept = Math.max(0, 1 - Math.min(1, Math.max(0, refundedCents) / orderTotalCents))
  return commissionCents(baseCents, pct) === 0 ? 0 : Math.round(commissionCents(baseCents, pct) * kept)
}

export const eligibleAt = (now: Date, pendingDays: number): string => new Date(now.getTime() + pendingDays * 86_400_000).toISOString()

/** An affiliate cannot earn on their own order: same email, ignoring case and spaces. */
export const isSelfReferral = (affiliateEmail: string | null | undefined, orderEmail: string | null | undefined): boolean => {
  const a = (affiliateEmail ?? '').trim().toLowerCase()
  return a !== '' && a === (orderEmail ?? '').trim().toLowerCase()
}

export type Balances = { pending: number; owed: number; paid: number }

/** What an affiliate is owed now (pending commissions whose wait is over), still waiting, and already paid. */
export function balances(rows: readonly { status: string; amount_cents: number; eligible_at: string | null }[], now: Date): Balances {
  const out: Balances = { pending: 0, owed: 0, paid: 0 }
  for (const r of rows) {
    const cents = Number(r.amount_cents) || 0
    if (r.status === 'paid') out.paid += cents
    else if (r.status === 'pending') {
      if (r.eligible_at && Date.parse(r.eligible_at) <= now.getTime()) out.owed += cents
      else out.pending += cents
    }
  }
  return out
}
