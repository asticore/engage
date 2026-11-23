import { meetsMinimum } from './commission'
import { shopPath } from '@/features/seo/permalinks'
import type { AffiliateStatus, ConsentCategory } from './core'
import { toConsentCategory } from './core'

type Stmt = { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<{ meta?: { last_row_id?: number } }> } }
export type D1 = { prepare: (sql: string) => Stmt }
type Row = Record<string, unknown>

export type Affiliate = { id: number; code: string; name: string; email: string; status: AffiliateStatus; visits: number; createdAt: string; token: string; ratePct: number | null; couponCode: string; payoutDetails: string }

const all = async (d1: D1, sql: string, ...args: unknown[]): Promise<Row[]> => (await d1.prepare(sql).bind(...args).all<Row>()).results
const toRate = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v))
const toStatus = (v: unknown): AffiliateStatus => (v === 'active' || v === 'suspended' ? v : 'pending')

export async function listAffiliates(d1: D1): Promise<Affiliate[]> {
  const rows = await all(
    d1,
    'SELECT a.id, a.code, a.name, a.email, a.status, a.created_at, a.token, a.rate_pct, a.coupon_code, a.payout_details, (SELECT COUNT(*) FROM eg_affiliate_visits v WHERE v.affiliate_id = a.id) AS visits FROM eg_affiliates a ORDER BY a.created_at DESC LIMIT 500',
  )
  return rows.map((r) => ({ id: Number(r.id), code: String(r.code), name: String(r.name ?? ''), email: String(r.email ?? ''), status: toStatus(r.status), visits: Number(r.visits ?? 0), createdAt: String(r.created_at ?? ''), token: String(r.token ?? ''), ratePct: toRate(r.rate_pct), couponCode: String(r.coupon_code ?? ''), payoutDetails: String(r.payout_details ?? '') }))
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

export type AffiliateSettings = { cookieDays: number; clickRule: 'first' | 'last'; commissionPct: number; pendingDays: number; autoApprove: boolean; terms: string; minPayoutCents: number; firstOrderOnly: boolean; consentCategory: ConsentCategory; emailNotifications: boolean; tiers: string; creatives: string; recurring: boolean; recurringMonths: number }
export const DEFAULT_SETTINGS: AffiliateSettings = { cookieDays: 30, clickRule: 'last', commissionPct: 10, pendingDays: 30, autoApprove: false, terms: '', minPayoutCents: 0, firstOrderOnly: false, consentCategory: 'necessary', emailNotifications: true, tiers: '', creatives: '', recurring: false, recurringMonths: 0 }

export async function getSettings(d1: D1): Promise<AffiliateSettings> {
  try {
    const r = (await all(d1, 'SELECT cookie_days, click_rule, commission_pct, pending_days, auto_approve, terms, min_payout_cents, first_order_only, consent_category, email_notifications, tiers, creatives, recurring, recurring_months FROM eg_affiliate_settings WHERE id = 1'))[0]
    if (!r) return DEFAULT_SETTINGS
    return { cookieDays: Number(r.cookie_days ?? 30), clickRule: r.click_rule === 'first' ? 'first' : 'last', commissionPct: Number(r.commission_pct ?? 10), pendingDays: Number(r.pending_days ?? 30), autoApprove: Number(r.auto_approve ?? 0) === 1, terms: String(r.terms ?? ''), minPayoutCents: Number(r.min_payout_cents ?? 0), firstOrderOnly: Number(r.first_order_only ?? 0) === 1, consentCategory: toConsentCategory(r.consent_category), emailNotifications: Number(r.email_notifications ?? 1) === 1, tiers: String(r.tiers ?? ''), creatives: String(r.creatives ?? ''), recurring: Number(r.recurring ?? 0) === 1, recurringMonths: Number(r.recurring_months ?? 0) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function saveSettings(d1: D1, s: AffiliateSettings, nowIso: string): Promise<void> {
  await d1
    .prepare('INSERT INTO eg_affiliate_settings (id, cookie_days, click_rule, commission_pct, pending_days, auto_approve, terms, min_payout_cents, first_order_only, consent_category, email_notifications, tiers, creatives, recurring, recurring_months, updated_at) VALUES (1,?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15) ON CONFLICT(id) DO UPDATE SET cookie_days=?1, click_rule=?2, commission_pct=?3, pending_days=?4, auto_approve=?5, terms=?6, min_payout_cents=?7, first_order_only=?8, consent_category=?9, email_notifications=?10, tiers=?11, creatives=?12, recurring=?13, recurring_months=?14, updated_at=?15')
    .bind(s.cookieDays, s.clickRule, s.commissionPct, s.pendingDays, s.autoApprove ? 1 : 0, s.terms, s.minPayoutCents, s.firstOrderOnly ? 1 : 0, s.consentCategory, s.emailNotifications ? 1 : 0, s.tiers, s.creatives, s.recurring ? 1 : 0, s.recurringMonths, nowIso)
    .run()
}

/* ---------------------------------------------------------- commissions */

export type CommissionRow = { id: number; affiliate_id: number; order_id: number; base_cents: number; rate_pct: number; amount_cents: number; status: string; eligible_at: string | null; created_at: string }
const toCommission = (r: Row): CommissionRow => ({ id: Number(r.id), affiliate_id: Number(r.affiliate_id), order_id: Number(r.order_id), base_cents: Number(r.base_cents ?? 0), rate_pct: Number(r.rate_pct ?? 0), amount_cents: Number(r.amount_cents ?? 0), status: String(r.status), eligible_at: r.eligible_at ? String(r.eligible_at) : null, created_at: String(r.created_at ?? '') })

export async function getAffiliateById(d1: D1, id: number): Promise<{ id: number; email: string; ratePct: number | null; name: string; code: string; token: string; status: AffiliateStatus } | null> {
  const r = (await all(d1, 'SELECT id, email, rate_pct, name, code, token, status FROM eg_affiliates WHERE id = ?1', id))[0]
  return r ? { id: Number(r.id), email: String(r.email ?? ''), ratePct: toRate(r.rate_pct), name: String(r.name ?? ''), code: String(r.code ?? ''), token: String(r.token ?? ''), status: toStatus(r.status) } : null
}

export async function setAffiliateRate(d1: D1, id: number, ratePct: number | null, nowIso: string): Promise<void> {
  await d1.prepare('UPDATE eg_affiliates SET rate_pct = ?1, updated_at = ?2 WHERE id = ?3').bind(ratePct, nowIso, id).run()
}

/** True when this affiliate already has a commission on an order from the same buyer (the first-order-only rule). */
export async function hasPriorOrderFrom(d1: D1, affiliateId: number, email: string): Promise<boolean> {
  if (email === '') return false
  return (await all(d1, "SELECT id FROM eg_affiliate_commissions WHERE affiliate_id = ?1 AND customer_email = ?2 AND status != 'reversed' LIMIT 1", affiliateId, email.trim().toLowerCase())).length > 0
}

/** The first earning (not reversed, not itself a renewal) for a buyer's email: whose referral a renewal belongs to, and when it began. */
export async function originalCommissionForEmail(d1: D1, email: string): Promise<{ affiliate_id: number; created_at: string } | null> {
  if (email.trim() === '') return null
  const r = (await all(d1, "SELECT affiliate_id, created_at FROM eg_affiliate_commissions WHERE customer_email = ?1 AND source != 'renewal' AND status != 'reversed' ORDER BY id ASC LIMIT 1", email.trim().toLowerCase()))[0]
  return r ? { affiliate_id: Number(r.affiliate_id), created_at: String(r.created_at ?? '') } : null
}

/** Pending commissions whose waiting period is over and whose "now payable" email has not been sent. */
export async function dueForPayableEmail(d1: D1, nowIso: string, limit = 100): Promise<Array<{ id: number; affiliate_id: number; order_id: number; amount_cents: number }>> {
  const rows = await all(d1, "SELECT id, affiliate_id, order_id, amount_cents FROM eg_affiliate_commissions WHERE status = 'pending' AND payable_notified = 0 AND amount_cents > 0 AND eligible_at IS NOT NULL AND eligible_at <= ?1 ORDER BY id LIMIT ?2", nowIso, limit)
  return rows.map((r) => ({ id: Number(r.id), affiliate_id: Number(r.affiliate_id), order_id: Number(r.order_id), amount_cents: Number(r.amount_cents ?? 0) }))
}

export async function markPayableNotified(d1: D1, commissionId: number): Promise<void> {
  await d1.prepare('UPDATE eg_affiliate_commissions SET payable_notified = 1 WHERE id = ?1').bind(commissionId).run()
}

export async function commissionForOrder(d1: D1, orderId: number): Promise<CommissionRow | null> {
  const r = (await all(d1, 'SELECT * FROM eg_affiliate_commissions WHERE order_id = ?1', orderId))[0]
  return r ? toCommission(r) : null
}

export async function insertTracked(d1: D1, v: { affiliateId: number; orderId: number; customerEmail?: string; utm?: { source: string; medium: string; campaign: string }; source?: 'link' | 'coupon' | 'renewal' }, nowIso: string): Promise<void> {
  await d1.prepare("INSERT OR IGNORE INTO eg_affiliate_commissions (affiliate_id, order_id, customer_email, utm_source, utm_medium, utm_campaign, source, status, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,'tracked',?8,?8)").bind(v.affiliateId, v.orderId, (v.customerEmail ?? '').trim().toLowerCase(), v.utm?.source ?? '', v.utm?.medium ?? '', v.utm?.campaign ?? '', v.source ?? 'link', nowIso).run()
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
export async function allCommissionRows(d1: D1): Promise<Array<{ affiliate_id: number; status: string; amount_cents: number; base_cents: number; eligible_at: string | null }>> {
  return (await all(d1, 'SELECT affiliate_id, status, amount_cents, base_cents, eligible_at FROM eg_affiliate_commissions')).map((r) => ({ affiliate_id: Number(r.affiliate_id), status: String(r.status), amount_cents: Number(r.amount_cents ?? 0), base_cents: Number(r.base_cents ?? 0), eligible_at: r.eligible_at ? String(r.eligible_at) : null }))
}

export async function hasCommissions(d1: D1, affiliateId: number): Promise<boolean> {
  return (await all(d1, 'SELECT id FROM eg_affiliate_commissions WHERE affiliate_id = ?1 LIMIT 1', affiliateId)).length > 0
}

export async function findByToken(d1: D1, token: string): Promise<Affiliate | null> {
  const r = (await all(d1, "SELECT a.id, a.code, a.name, a.email, a.status, a.created_at, a.token, a.rate_pct, a.coupon_code, a.payout_details, (SELECT COUNT(*) FROM eg_affiliate_visits v WHERE v.affiliate_id = a.id) AS visits FROM eg_affiliates a WHERE a.token = ?1 AND a.token != ''", token))[0]
  return r ? { id: Number(r.id), code: String(r.code), name: String(r.name ?? ''), email: String(r.email ?? ''), status: toStatus(r.status), visits: Number(r.visits ?? 0), createdAt: String(r.created_at ?? ''), token: String(r.token), ratePct: toRate(r.rate_pct), couponCode: String(r.coupon_code ?? ''), payoutDetails: String(r.payout_details ?? '') } : null
}

export async function emailTaken(d1: D1, email: string): Promise<boolean> {
  return email !== '' && (await all(d1, 'SELECT id FROM eg_affiliates WHERE lower(email) = ?1', email.toLowerCase())).length > 0
}

export async function setToken(d1: D1, id: number, token: string, nowIso: string): Promise<void> {
  await d1.prepare('UPDATE eg_affiliates SET token = ?1, updated_at = ?2 WHERE id = ?3').bind(token, nowIso, id).run()
}

/** Every payout with the affiliate's name and email, newest first, for the CSV export. */
export async function payoutsForExport(d1: D1): Promise<Array<{ createdAt: string; name: string; email: string; amountCents: number; note: string; details: string }>> {
  return (await all(d1, 'SELECT p.created_at, p.amount_cents, p.note, a.name, a.email, a.payout_details FROM eg_affiliate_payouts p LEFT JOIN eg_affiliates a ON a.id = p.affiliate_id ORDER BY p.id DESC LIMIT 5000')).map((r) => ({ createdAt: String(r.created_at ?? ''), name: String(r.name ?? ''), email: String(r.email ?? ''), amountCents: Number(r.amount_cents ?? 0), note: String(r.note ?? ''), details: String(r.payout_details ?? '') }))
}

/** True once the owner has saved the program settings at least once. */
export async function settingsConfigured(d1: D1): Promise<boolean> {
  try {
    return (await all(d1, 'SELECT id FROM eg_affiliate_settings WHERE id = 1')).length > 0
  } catch {
    return false
  }
}

export async function setAffiliateCoupon(d1: D1, id: number, coupon: string, nowIso: string): Promise<void> {
  await d1.prepare('UPDATE eg_affiliates SET coupon_code = ?1, updated_at = ?2 WHERE id = ?3').bind(coupon, nowIso, id).run()
}

export async function couponTaken(d1: D1, coupon: string, exceptId: number): Promise<boolean> {
  return coupon !== '' && (await all(d1, 'SELECT id FROM eg_affiliates WHERE coupon_code = ?1 AND id != ?2', coupon, exceptId)).length > 0
}

/** The active affiliate who owns a coupon code, if any. */
export async function findActiveByCoupon(d1: D1, coupon: string): Promise<{ id: number; code: string } | null> {
  if (coupon === '') return null
  const r = (await all(d1, "SELECT id, code FROM eg_affiliates WHERE coupon_code = ?1 AND status = 'active'", coupon))[0]
  return r ? { id: Number(r.id), code: String(r.code) } : null
}

/* ----------------------------------------------------- product rates and tiers */

export async function getProductRates(d1: D1): Promise<Map<number, number>> {
  try {
    return new Map((await all(d1, 'SELECT product_id, rate_pct FROM eg_affiliate_product_rates')).map((r) => [Number(r.product_id), Number(r.rate_pct)]))
  } catch {
    return new Map()
  }
}

export async function setProductRate(d1: D1, productId: number, ratePct: number | null, nowIso: string): Promise<void> {
  if (ratePct === null) await d1.prepare('DELETE FROM eg_affiliate_product_rates WHERE product_id = ?1').bind(productId).run()
  else await d1.prepare('INSERT INTO eg_affiliate_product_rates (product_id, rate_pct, updated_at) VALUES (?1,?2,?3) ON CONFLICT(product_id) DO UPDATE SET rate_pct=?2, updated_at=?3').bind(productId, ratePct, nowIso).run()
}

export async function listProductRates(d1: D1): Promise<Array<{ productId: number; ratePct: number; title: string }>> {
  try {
    return (await all(d1, 'SELECT r.product_id, r.rate_pct, p.title FROM eg_affiliate_product_rates r LEFT JOIN eg_products p ON p.id = r.product_id ORDER BY r.product_id')).map((x) => ({ productId: Number(x.product_id), ratePct: Number(x.rate_pct), title: String(x.title ?? `Product #${x.product_id}`) }))
  } catch {
    return []
  }
}

export async function getTagRates(d1: D1): Promise<Map<number, number>> {
  try {
    return new Map((await all(d1, 'SELECT tag_id, rate_pct FROM eg_affiliate_tag_rates')).map((r) => [Number(r.tag_id), Number(r.rate_pct)]))
  } catch {
    return new Map()
  }
}

export async function setTagRate(d1: D1, tagId: number, ratePct: number | null, nowIso: string): Promise<void> {
  if (ratePct === null) await d1.prepare('DELETE FROM eg_affiliate_tag_rates WHERE tag_id = ?1').bind(tagId).run()
  else await d1.prepare('INSERT INTO eg_affiliate_tag_rates (tag_id, rate_pct, updated_at) VALUES (?1,?2,?3) ON CONFLICT(tag_id) DO UPDATE SET rate_pct=?2, updated_at=?3').bind(tagId, ratePct, nowIso).run()
}

export async function listTagRates(d1: D1): Promise<Array<{ tagId: number; ratePct: number; name: string }>> {
  try {
    return (await all(d1, 'SELECT r.tag_id, r.rate_pct, t.name FROM eg_affiliate_tag_rates r LEFT JOIN eg_product_tags t ON t.id = r.tag_id ORDER BY r.tag_id')).map((x) => ({ tagId: Number(x.tag_id), ratePct: Number(x.rate_pct), name: String(x.name ?? '') }))
  } catch {
    return []
  }
}

export async function tagChoices(d1: D1): Promise<Array<{ id: number; name: string }>> {
  try {
    return (await all(d1, 'SELECT id, name FROM eg_product_tags ORDER BY name LIMIT 500')).map((r) => ({ id: Number(r.id), name: String(r.name ?? '') }))
  } catch {
    return []
  }
}

/** Which tags each of the given products has (only when some tag has a rate, so most orders skip the lookup). */
export async function productTagMap(d1: D1, productIds: readonly number[]): Promise<Map<number, number[]>> {
  const out = new Map<number, number[]>()
  const ids = [...new Set(productIds.filter((n) => Number.isInteger(n) && n > 0))].slice(0, 50)
  if (ids.length === 0) return out
  try {
    const marks = ids.map((_, i) => `?${i + 1}`).join(',')
    for (const r of await all(d1, `SELECT parent_id, eg_product_tags_id FROM eg_products_rels WHERE path = 'tags' AND eg_product_tags_id IS NOT NULL AND parent_id IN (${marks})`, ...ids)) {
      const list = out.get(Number(r.parent_id)) ?? []
      list.push(Number(r.eg_product_tags_id))
      out.set(Number(r.parent_id), list)
    }
  } catch {
    // The shop tables may not exist: no tag rates then.
  }
  return out
}

export async function productChoices(d1: D1): Promise<Array<{ id: number; title: string }>> {
  try {
    return (await all(d1, 'SELECT id, title FROM eg_products ORDER BY title LIMIT 500')).map((r) => ({ id: Number(r.id), title: String(r.title ?? '') }))
  } catch {
    return []
  }
}

/** What an affiliate's commissions have been worked on so far (waiting and paid, not reversed), for tier rates. */
export async function lifetimeSalesCents(d1: D1, affiliateId: number): Promise<number> {
  return Number((await all(d1, "SELECT COALESCE(SUM(base_cents),0) AS n FROM eg_affiliate_commissions WHERE affiliate_id = ?1 AND status IN ('pending','paid')", affiliateId))[0]?.n ?? 0)
}

/** The newest tracked visits with the affiliate's name, for the visit log on the Affiliates screen. */
export async function recentVisits(d1: D1, limit = 50): Promise<Array<{ id: number; affiliate: string; path: string; source: string; medium: string; campaign: string; createdAt: string }>> {
  return (await all(d1, 'SELECT v.id, v.path, v.utm_source, v.utm_medium, v.utm_campaign, v.created_at, a.name FROM eg_affiliate_visits v LEFT JOIN eg_affiliates a ON a.id = v.affiliate_id ORDER BY v.id DESC LIMIT ?1', limit)).map((r) => ({ id: Number(r.id), affiliate: String(r.name ?? ''), path: String(r.path ?? '/'), source: String(r.utm_source ?? ''), medium: String(r.utm_medium ?? ''), campaign: String(r.utm_campaign ?? ''), createdAt: String(r.created_at ?? '') }))
}

/** The affiliate whose email matches (case-insensitive), for the signed-in member page. */
export async function findByEmail(d1: D1, email: string): Promise<Affiliate | null> {
  if (email === '') return null
  const r = (await all(d1, 'SELECT a.id, a.code, a.name, a.email, a.status, a.created_at, a.token, a.rate_pct, a.coupon_code, a.payout_details, (SELECT COUNT(*) FROM eg_affiliate_visits v WHERE v.affiliate_id = a.id) AS visits FROM eg_affiliates a WHERE lower(a.email) = ?1 LIMIT 1', email.trim().toLowerCase()))[0]
  return r ? { id: Number(r.id), code: String(r.code), name: String(r.name ?? ''), email: String(r.email ?? ''), status: toStatus(r.status), visits: Number(r.visits ?? 0), createdAt: String(r.created_at ?? ''), token: String(r.token ?? ''), ratePct: toRate(r.rate_pct), couponCode: String(r.coupon_code ?? ''), payoutDetails: String(r.payout_details ?? '') } : null
}

export type Creative = { id: number; url: string; alt: string; filename: string; width: number; height: number }
const toCreative = (r: Row): Creative => ({ id: Number(r.id), url: String(r.url ?? ''), alt: String(r.alt ?? ''), filename: String(r.filename ?? ''), width: Number(r.width ?? 0), height: Number(r.height ?? 0) })

/** Recent images from the media library, for picking the creatives kit. */
export async function imageChoices(d1: D1): Promise<Creative[]> {
  try {
    return (await all(d1, "SELECT id, url, alt, filename, width, height FROM eg_media WHERE mime_type LIKE 'image/%' ORDER BY id DESC LIMIT 100")).map(toCreative)
  } catch {
    return []
  }
}

/** The chosen creatives, in the order picked. Missing files are skipped. */
export async function creativesByIds(d1: D1, ids: number[]): Promise<Creative[]> {
  if (ids.length === 0) return []
  try {
    const rows = (await all(d1, `SELECT id, url, alt, filename, width, height FROM eg_media WHERE id IN (${ids.map((_, i) => `?${i + 1}`).join(',')})`, ...ids)).map(toCreative)
    return ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is Creative => Boolean(r && r.url))
  } catch {
    return []
  }
}

export async function setPayoutDetails(d1: D1, id: number, details: string, nowIso: string): Promise<void> {
  await d1.prepare('UPDATE eg_affiliates SET payout_details = ?1, updated_at = ?2 WHERE id = ?3').bind(details, nowIso, id).run()
}

/** Counts one ignored crawler or script hit for today. Best effort. */
export async function countBotHit(d1: D1, day: string): Promise<void> {
  await d1.prepare('INSERT INTO eg_affiliate_bot_hits (day, hits) VALUES (?1, 1) ON CONFLICT(day) DO UPDATE SET hits = hits + 1').bind(day).run()
}

/** Ignored crawler and script hits since a day (inclusive, YYYY-MM-DD). */
export async function botHitsSince(d1: D1, sinceDay: string): Promise<number> {
  try {
    return Number((await all(d1, 'SELECT COALESCE(SUM(hits),0) AS n FROM eg_affiliate_bot_hits WHERE day >= ?1', sinceDay))[0]?.n ?? 0)
  } catch {
    return 0
  }
}


/* ----------------------------------------------------- short links (vanity codes) */

export type ShortLink = { code: string; affiliateId: number; productId: number | null; productTitle: string; createdAt: string }

export async function listShortLinks(d1: D1, affiliateId: number | null = null): Promise<ShortLink[]> {
  try {
    const rows = affiliateId
      ? await all(d1, 'SELECT l.code, l.affiliate_id, l.product_id, l.created_at, p.title FROM eg_affiliate_links l LEFT JOIN eg_products p ON p.id = l.product_id WHERE l.affiliate_id = ?1 ORDER BY l.created_at DESC LIMIT 200', affiliateId)
      : await all(d1, 'SELECT l.code, l.affiliate_id, l.product_id, l.created_at, p.title FROM eg_affiliate_links l LEFT JOIN eg_products p ON p.id = l.product_id ORDER BY l.created_at DESC LIMIT 200')
    return rows.map((r) => ({ code: String(r.code), affiliateId: Number(r.affiliate_id), productId: r.product_id === null || r.product_id === undefined ? null : Number(r.product_id), productTitle: String(r.title ?? ''), createdAt: String(r.created_at ?? '') }))
  } catch {
    return []
  }
}

/** False when the code is already used by another short link. */
export async function addShortLink(d1: D1, v: { code: string; affiliateId: number; productId: number | null }, nowIso: string): Promise<boolean> {
  if ((await all(d1, 'SELECT code FROM eg_affiliate_links WHERE code = ?1', v.code)).length > 0) return false
  await d1.prepare('INSERT INTO eg_affiliate_links (code, affiliate_id, product_id, created_at) VALUES (?1,?2,?3,?4)').bind(v.code, v.affiliateId, v.productId, nowIso).run()
  return true
}

export async function removeShortLink(d1: D1, code: string): Promise<void> {
  await d1.prepare('DELETE FROM eg_affiliate_links WHERE code = ?1').bind(code).run()
}

/** Where a short link goes: the affiliate's referral code and the path of its product (or the home page). Null when the link is unknown. */
export async function resolveShortLink(d1: D1, code: string): Promise<{ affiliateId: number; path: string } | null> {
  try {
    const link = (await all(d1, 'SELECT affiliate_id, product_id FROM eg_affiliate_links WHERE code = ?1', code))[0]
    if (!link) return null
    let path = '/'
    if (link.product_id !== null && link.product_id !== undefined) {
      const product = (await all(d1, "SELECT slug FROM eg_products WHERE id = ?1 AND _status = 'published' AND deleted_at IS NULL", Number(link.product_id)))[0]
      const slug = String(product?.slug ?? '')
      if (slug !== '') path = shopPath(await (await import('@/features/seo/permalinkStore')).readShopBase(), `/${encodeURIComponent(slug)}`)
    }
    return { affiliateId: Number(link.affiliate_id), path }
  } catch {
    return null
  }
}
