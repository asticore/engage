import { meetsMinimum } from './commission'
import type { AffiliateStatus } from './core'

type Stmt = { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<{ meta?: { last_row_id?: number } }> } }
export type D1 = { prepare: (sql: string) => Stmt }
type Row = Record<string, unknown>

export type Affiliate = { id: number; code: string; name: string; email: string; status: AffiliateStatus; visits: number; createdAt: string; token: string; ratePct: number | null }

const all = async (d1: D1, sql: string, ...args: unknown[]): Promise<Row[]> => (await d1.prepare(sql).bind(...args).all<Row>()).results
const toRate = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v))
const toStatus = (v: unknown): AffiliateStatus => (v === 'active' || v === 'suspended' ? v : 'pending')

export async function listAffiliates(d1: D1): Promise<Affiliate[]> {
  const rows = await all(
    d1,
    'SELECT a.id, a.code, a.name, a.email, a.status, a.created_at, a.token, a.rate_pct, (SELECT COUNT(*) FROM eg_affiliate_visits v WHERE v.affiliate_id = a.id) AS visits FROM eg_affiliates a ORDER BY a.created_at DESC LIMIT 500',
  )
  return rows.map((r) => ({ id: Number(r.id), code: String(r.code), name: String(r.name ?? ''), email: String(r.email ?? ''), status: toStatus(r.status), visits: Number(r.visits ?? 0), createdAt: String(r.created_at ?? ''), token: String(r.token ?? ''), ratePct: toRate(r.rate_pct) }))
}

export async function countAffiliates(d1: D1): Promise<number> {
  return Number((await all(d1, 'SELECT COUNT(*) AS n FROM eg_affiliates'))[0]?.n ?? 0)
}

export async function findActiveByCode(d1: D1, code: string): Promise<{ id: number; code: string } | null> {
  const r = (await all(d1, "SELECT id, code FROM eg_affiliates WHERE code = ?1 AND status = 'active'", code))[0]
  return r ? { id: Number(r.id), code: String(r.code) } : null
}

export async function codeTaken(d1: D1, code: string): Promise<boolean> {
  return (await all(d1, 'SELECT id FROM eg_affiliates WHERE code = ?1', code)).length > 0
}

export async function createAffiliate(d1: D1, v: { code: string; name: string; email: string; status: AffiliateStatus; token: string }, nowIso: string): Promise<number> {
  const res = await d1.prepare('INSERT INTO eg_affiliates (code, name, email, status, token, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?6)').bind(v.code, v.name, v.email, v.status, v.token, nowIso).run()
  return Number(res.meta?.last_row_id ?? 0)
}

export async function setAffiliateStatus(d1: D1, id: number, status: AffiliateStatus, nowIso: string): Promise<void> {
  await d1.prepare('UPDATE eg_affiliates SET status = ?1, updated_at = ?2 WHERE id = ?3').bind(status, nowIso, id).run()
}

export async function deleteAffiliate(d1: D1, id: number): Promise<void> {
  await d1.prepare('DELETE FROM eg_affiliate_visits WHERE affiliate_id = ?1').bind(id).run()
  await d1.prepare('DELETE FROM eg_affiliates WHERE id = ?1').bind(id).run()
}

export async function logVisit(d1: D1, v: { affiliateId: number; path: string; source: string; medium: string; campaign: string }, nowIso: string): Promise<void> {
  await d1.prepare('INSERT INTO eg_affiliate_visits (affiliate_id, path, utm_source, utm_medium, utm_campaign, created_at) VALUES (?1,?2,?3,?4,?5,?6)').bind(v.affiliateId, v.path, v.source, v.medium, v.campaign, nowIso).run()
}

/* ------------------------------------------------------------- settings */

export type AffiliateSettings = { cookieDays: number; clickRule: 'first' | 'last'; commissionPct: number; pendingDays: number; autoApprove: boolean; terms: string; minPayoutCents: number; firstOrderOnly: boolean }
export const DEFAULT_SETTINGS: AffiliateSettings = { cookieDays: 30, clickRule: 'last', commissionPct: 10, pendingDays: 30, autoApprove: false, terms: '', minPayoutCents: 0, firstOrderOnly: false }

export async function getSettings(d1: D1): Promise<AffiliateSettings> {
  try {
    const r = (await all(d1, 'SELECT cookie_days, click_rule, commission_pct, pending_days, auto_approve, terms, min_payout_cents, first_order_only FROM eg_affiliate_settings WHERE id = 1'))[0]
    if (!r) return DEFAULT_SETTINGS
    return { cookieDays: Number(r.cookie_days ?? 30), clickRule: r.click_rule === 'first' ? 'first' : 'last', commissionPct: Number(r.commission_pct ?? 10), pendingDays: Number(r.pending_days ?? 30), autoApprove: Number(r.auto_approve ?? 0) === 1, terms: String(r.terms ?? ''), minPayoutCents: Number(r.min_payout_cents ?? 0), firstOrderOnly: Number(r.first_order_only ?? 0) === 1 }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function saveSettings(d1: D1, s: AffiliateSettings, nowIso: string): Promise<void> {
  await d1
    .prepare('INSERT INTO eg_affiliate_settings (id, cookie_days, click_rule, commission_pct, pending_days, auto_approve, terms, min_payout_cents, first_order_only, updated_at) VALUES (1,?1,?2,?3,?4,?5,?6,?7,?8,?9) ON CONFLICT(id) DO UPDATE SET cookie_days=?1, click_rule=?2, commission_pct=?3, pending_days=?4, auto_approve=?5, terms=?6, min_payout_cents=?7, first_order_only=?8, updated_at=?9')
    .bind(s.cookieDays, s.clickRule, s.commissionPct, s.pendingDays, s.autoApprove ? 1 : 0, s.terms, s.minPayoutCents, s.firstOrderOnly ? 1 : 0, nowIso)
    .run()
}

/* ---------------------------------------------------------- commissions */

export type CommissionRow = { id: number; affiliate_id: number; order_id: number; base_cents: number; rate_pct: number; amount_cents: number; status: string; eligible_at: string | null; created_at: string }
const toCommission = (r: Row): CommissionRow => ({ id: Number(r.id), affiliate_id: Number(r.affiliate_id), order_id: Number(r.order_id), base_cents: Number(r.base_cents ?? 0), rate_pct: Number(r.rate_pct ?? 0), amount_cents: Number(r.amount_cents ?? 0), status: String(r.status), eligible_at: r.eligible_at ? String(r.eligible_at) : null, created_at: String(r.created_at ?? '') })

export async function getAffiliateById(d1: D1, id: number): Promise<{ id: number; email: string; ratePct: number | null } | null> {
  const r = (await all(d1, 'SELECT id, email, rate_pct FROM eg_affiliates WHERE id = ?1', id))[0]
  return r ? { id: Number(r.id), email: String(r.email ?? ''), ratePct: toRate(r.rate_pct) } : null
}

export async function setAffiliateRate(d1: D1, id: number, ratePct: number | null, nowIso: string): Promise<void> {
  await d1.prepare('UPDATE eg_affiliates SET rate_pct = ?1, updated_at = ?2 WHERE id = ?3').bind(ratePct, nowIso, id).run()
}

/** True when this affiliate already has a commission on an order from the same buyer (the first-order-only rule). */
export async function hasPriorOrderFrom(d1: D1, affiliateId: number, email: string): Promise<boolean> {
  if (email === '') return false
  return (await all(d1, "SELECT id FROM eg_affiliate_commissions WHERE affiliate_id = ?1 AND customer_email = ?2 AND status != 'reversed' LIMIT 1", affiliateId, email.trim().toLowerCase())).length > 0
}

export async function commissionForOrder(d1: D1, orderId: number): Promise<CommissionRow | null> {
  const r = (await all(d1, 'SELECT * FROM eg_affiliate_commissions WHERE order_id = ?1', orderId))[0]
  return r ? toCommission(r) : null
}

export async function insertTracked(d1: D1, v: { affiliateId: number; orderId: number; customerEmail?: string }, nowIso: string): Promise<void> {
  await d1.prepare("INSERT OR IGNORE INTO eg_affiliate_commissions (affiliate_id, order_id, customer_email, status, created_at, updated_at) VALUES (?1,?2,?3,'tracked',?4,?4)").bind(v.affiliateId, v.orderId, (v.customerEmail ?? '').trim().toLowerCase(), nowIso).run()
}

/** tracked -> pending, once. Does nothing for a commission that is already past tracked. */
export async function markCommissionPending(d1: D1, v: { orderId: number; base: number; pct: number; amount: number; eligibleAt: string }, nowIso: string): Promise<boolean> {
  const res = await d1
    .prepare("UPDATE eg_affiliate_commissions SET base_cents=?1, rate_pct=?2, amount_cents=?3, eligible_at=?4, status='pending', updated_at=?5 WHERE order_id=?6 AND status='tracked'")
    .bind(v.base, v.pct, v.amount, v.eligibleAt, nowIso, v.orderId)
    .run()
  return Number((res as { meta?: { changes?: number } }).meta?.changes ?? 1) > 0
}

export async function setCommissionAmount(d1: D1, orderId: number, amount: number, status: string, nowIso: string): Promise<void> {
  await d1.prepare("UPDATE eg_affiliate_commissions SET amount_cents=?1, status=?2, updated_at=?3 WHERE order_id=?4 AND status IN ('tracked','pending','paid')").bind(amount, status, nowIso, orderId).run()
}

export async function commissionsFor(d1: D1, affiliateId: number | null, limit = 100): Promise<CommissionRow[]> {
  const rows = affiliateId
    ? await all(d1, 'SELECT * FROM eg_affiliate_commissions WHERE affiliate_id = ?1 ORDER BY id DESC LIMIT ?2', affiliateId, limit)
    : await all(d1, 'SELECT * FROM eg_affiliate_commissions ORDER BY id DESC LIMIT ?1', limit)
  return rows.map(toCommission)
}

/** Records a manual payout for everything an affiliate is owed (pending commissions whose wait is over). Returns the amount. */
export async function recordPayout(d1: D1, affiliateId: number, note: string, nowIso: string, minCents = 0): Promise<{ id: number; amount: number } | null> {
  const due = (await all(d1, "SELECT id, amount_cents FROM eg_affiliate_commissions WHERE affiliate_id = ?1 AND status = 'pending' AND eligible_at IS NOT NULL AND eligible_at <= ?2 AND amount_cents > 0", affiliateId, nowIso))
  const amount = due.reduce((sum, r) => sum + Number(r.amount_cents), 0)
  if (!meetsMinimum(amount, minCents)) return null
  const res = await d1.prepare('INSERT INTO eg_affiliate_payouts (affiliate_id, amount_cents, note, created_at) VALUES (?1,?2,?3,?4)').bind(affiliateId, amount, note, nowIso).run()
  const payoutId = Number(res.meta?.last_row_id ?? 0)
  for (const r of due) await d1.prepare("UPDATE eg_affiliate_commissions SET status='paid', payout_id=?1, updated_at=?2 WHERE id=?3 AND status='pending'").bind(payoutId, nowIso, Number(r.id)).run()
  return { id: payoutId, amount }
}

export async function payoutsFor(d1: D1, limit = 100): Promise<Array<{ id: number; affiliateId: number; amountCents: number; note: string; createdAt: string }>> {
  return (await all(d1, 'SELECT id, affiliate_id, amount_cents, note, created_at FROM eg_affiliate_payouts ORDER BY id DESC LIMIT ?1', limit)).map((r) => ({ id: Number(r.id), affiliateId: Number(r.affiliate_id), amountCents: Number(r.amount_cents), note: String(r.note ?? ''), createdAt: String(r.created_at ?? '') }))
}

/** Every commission row with its affiliate, for balances. */
export async function allCommissionRows(d1: D1): Promise<Array<{ affiliate_id: number; status: string; amount_cents: number; eligible_at: string | null }>> {
  return (await all(d1, 'SELECT affiliate_id, status, amount_cents, eligible_at FROM eg_affiliate_commissions')).map((r) => ({ affiliate_id: Number(r.affiliate_id), status: String(r.status), amount_cents: Number(r.amount_cents ?? 0), eligible_at: r.eligible_at ? String(r.eligible_at) : null }))
}

export async function hasCommissions(d1: D1, affiliateId: number): Promise<boolean> {
  return (await all(d1, 'SELECT id FROM eg_affiliate_commissions WHERE affiliate_id = ?1 LIMIT 1', affiliateId)).length > 0
}

export async function findByToken(d1: D1, token: string): Promise<Affiliate | null> {
  const r = (await all(d1, "SELECT a.id, a.code, a.name, a.email, a.status, a.created_at, a.token, a.rate_pct, (SELECT COUNT(*) FROM eg_affiliate_visits v WHERE v.affiliate_id = a.id) AS visits FROM eg_affiliates a WHERE a.token = ?1 AND a.token != ''", token))[0]
  return r ? { id: Number(r.id), code: String(r.code), name: String(r.name ?? ''), email: String(r.email ?? ''), status: toStatus(r.status), visits: Number(r.visits ?? 0), createdAt: String(r.created_at ?? ''), token: String(r.token), ratePct: toRate(r.rate_pct) } : null
}

export async function emailTaken(d1: D1, email: string): Promise<boolean> {
  return email !== '' && (await all(d1, 'SELECT id FROM eg_affiliates WHERE lower(email) = ?1', email.toLowerCase())).length > 0
}

export async function setToken(d1: D1, id: number, token: string, nowIso: string): Promise<void> {
  await d1.prepare('UPDATE eg_affiliates SET token = ?1, updated_at = ?2 WHERE id = ?3').bind(token, nowIso, id).run()
}

/** Every payout with the affiliate's name and email, newest first, for the CSV export. */
export async function payoutsForExport(d1: D1): Promise<Array<{ createdAt: string; name: string; email: string; amountCents: number; note: string }>> {
  return (await all(d1, 'SELECT p.created_at, p.amount_cents, p.note, a.name, a.email FROM eg_affiliate_payouts p LEFT JOIN eg_affiliates a ON a.id = p.affiliate_id ORDER BY p.id DESC LIMIT 5000')).map((r) => ({ createdAt: String(r.created_at ?? ''), name: String(r.name ?? ''), email: String(r.email ?? ''), amountCents: Number(r.amount_cents ?? 0), note: String(r.note ?? '') }))
}
