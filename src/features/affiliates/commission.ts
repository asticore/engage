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

/** The rate used for an affiliate: their own override when set, otherwise the program rate. */
export const effectiveRate = (override: number | null | undefined, programPct: number): number => (override === null || override === undefined ? programPct : clampPct(override, programPct))

/** A payout is only recorded once what is owed reaches the minimum (0 means no minimum). */
export const meetsMinimum = (owedCents: number, minCents: number): boolean => owedCents > 0 && owedCents >= Math.max(0, minCents)

const csvCell = (value: unknown): string => {
  let text = String(value ?? '')
  // Spreadsheet formulas: a cell that starts with = + - or @ is read as a formula, so it is prefixed with a quote.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** A payout log as CSV: date, affiliate, email, amount in dollars, note, the affiliate's payout details. */
export function payoutsCsv(rows: readonly { createdAt: string; name: string; email: string; amountCents: number; note: string; details?: string }[]): string {
  const lines = [['Date', 'Affiliate', 'Email', 'Amount', 'Note', 'Payout details'].join(',')]
  for (const r of rows) lines.push([r.createdAt.slice(0, 10), r.name, r.email, (r.amountCents / 100).toFixed(2), r.note, r.details ?? ''].map(csvCell).join(','))
  return `${lines.join('\r\n')}\r\n`
}

export type Tier = { minCents: number; pct: number }

/** Sales tiers from text, one per line: "sales in dollars, rate percent" (for example "1000, 12"). Bad lines are skipped; sorted by sales. */
export function parseTiers(text: unknown): Tier[] {
  const out: Tier[] = []
  for (const line of String(text ?? '').split(/\r?\n/).slice(0, 20)) {
    const [dollars, pct] = line.split(/[,;\t]/).map((v) => Number(v.trim().replace(/^\$|%$/g, '')))
    if (Number.isFinite(dollars) && Number.isFinite(pct) && dollars > 0 && pct >= 0 && pct <= 100) out.push({ minCents: Math.round(dollars * 100), pct })
  }
  return out.sort((a, b) => a.minCents - b.minCents)
}

/** The program rate, raised by the highest tier whose sales an affiliate has reached. */
export function tierRate(tiers: readonly Tier[], lifetimeSalesCents: number, programPct: number): number {
  let pct = programPct
  for (const t of tiers) if (lifetimeSalesCents >= t.minCents) pct = t.pct
  return pct
}

export type CommissionLine = { productId: number | null; netCents: number }

/**
 * One commission for an order, worked line by line. The order discount is shared across lines in proportion to their value.
 * A line takes the product's own rate when it has one, else `defaultPct`; an `override` (the affiliate's own rate) beats both.
 * Returns the base, the amount and the blended percent (kept unrounded so the amount can be worked out again for refunds).
 * With no usable lines the flat base is used.
 */
export function commissionForLines(
  lines: readonly { productId?: unknown; lineCents?: unknown; quantity?: unknown; unitCents?: unknown }[] | null | undefined,
  subtotalCents: unknown,
  discountCents: unknown,
  rates: { override: number | null | undefined; productRates: ReadonlyMap<number, number>; defaultPct: number },
): { base: number; amount: number; pct: number } {
  const flatBase = commissionBase(subtotalCents, discountCents)
  const items: CommissionLine[] = (Array.isArray(lines) ? lines : [])
    .map((l) => ({ productId: Number.isInteger(Number(l?.productId)) && Number(l?.productId) > 0 ? Number(l?.productId) : null, netCents: Math.max(0, Math.round(Number(l?.lineCents) || (Number(l?.unitCents) || 0) * (Number(l?.quantity) || 0))) }))
    .filter((l) => l.netCents > 0)
  const gross = items.reduce((n, l) => n + l.netCents, 0)
  const discount = Math.max(0, Math.round(Number(discountCents) || 0))
  if (items.length === 0 || gross <= 0) {
    const pct = effectiveRate(rates.override, rates.defaultPct)
    return { base: flatBase, amount: commissionCents(flatBase, pct), pct }
  }
  let base = 0
  let amount = 0
  for (const l of items) {
    const net = Math.max(0, l.netCents - (discount * l.netCents) / gross)
    const pct = rates.override ?? (l.productId !== null ? rates.productRates.get(l.productId) : undefined) ?? rates.defaultPct
    base += net
    amount += (net * pct) / 100
  }
  base = Math.round(base)
  amount = Math.round(amount)
  return { base, amount, pct: base > 0 ? (amount * 100) / base : 0 }
}

export type AffiliateReport = { orders: number; salesCents: number; conversionPct: number }

/** Orders, commissioned sales and conversion (orders per visit) for one affiliate. Reversed commissions do not count. */
export function affiliateReport(rows: readonly { status: string; base_cents?: number }[], visits: number): AffiliateReport {
  const live = rows.filter((r) => r.status !== 'reversed')
  const salesCents = live.reduce((n, r) => n + (Number(r.base_cents) || 0), 0)
  const conversionPct = visits > 0 ? Math.round((live.length / visits) * 10000) / 100 : 0
  return { orders: live.length, salesCents, conversionPct }
}

/** Whether a renewal paid at `nowIso` still earns commission: `months` after the first order (0 means no limit). */
export function renewalWindowOpen(firstIso: string, nowIso: string, months: number): boolean {
  if (months <= 0) return true
  const first = new Date(firstIso)
  const now = new Date(nowIso)
  if (Number.isNaN(first.getTime()) || Number.isNaN(now.getTime())) return false
  const end = new Date(first)
  end.setUTCMonth(end.getUTCMonth() + months)
  return now.getTime() <= end.getTime()
}
