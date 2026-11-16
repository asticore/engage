import type { AffiliateStatus } from './core'

type Stmt = { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<{ meta?: { last_row_id?: number } }> } }
export type D1 = { prepare: (sql: string) => Stmt }
type Row = Record<string, unknown>

export type Affiliate = { id: number; code: string; name: string; email: string; status: AffiliateStatus; visits: number; createdAt: string }

const all = async (d1: D1, sql: string, ...args: unknown[]): Promise<Row[]> => (await d1.prepare(sql).bind(...args).all<Row>()).results
const toStatus = (v: unknown): AffiliateStatus => (v === 'active' || v === 'suspended' ? v : 'pending')

export async function listAffiliates(d1: D1): Promise<Affiliate[]> {
  const rows = await all(
    d1,
    'SELECT a.id, a.code, a.name, a.email, a.status, a.created_at, (SELECT COUNT(*) FROM eg_affiliate_visits v WHERE v.affiliate_id = a.id) AS visits FROM eg_affiliates a ORDER BY a.created_at DESC LIMIT 500',
  )
  return rows.map((r) => ({ id: Number(r.id), code: String(r.code), name: String(r.name ?? ''), email: String(r.email ?? ''), status: toStatus(r.status), visits: Number(r.visits ?? 0), createdAt: String(r.created_at ?? '') }))
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

export async function createAffiliate(d1: D1, v: { code: string; name: string; email: string; status: AffiliateStatus }, nowIso: string): Promise<number> {
  const res = await d1.prepare('INSERT INTO eg_affiliates (code, name, email, status, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?5)').bind(v.code, v.name, v.email, v.status, nowIso).run()
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
