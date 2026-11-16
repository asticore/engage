import { toStatus, type FranchiseStatus } from './core'

type Stmt = { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<{ meta?: { last_row_id?: number } }> } }
export type D1 = { prepare: (sql: string) => Stmt }
type Row = Record<string, unknown>

export type Franchise = { id: number; name: string; host: string; ownerEmail: string; status: FranchiseStatus; createdAt: string; pages: number; lastRolledAt: string | null }

const all = async (d1: D1, sql: string, ...args: unknown[]): Promise<Row[]> => (await d1.prepare(sql).bind(...args).all<Row>()).results

const SELECT = 'SELECT f.id, f.name, f.host, f.owner_email, f.status, f.created_at, (SELECT COUNT(*) FROM eg_franchise_pages p WHERE p.franchise_id = f.id) AS pages, (SELECT MAX(p.rolled_at) FROM eg_franchise_pages p WHERE p.franchise_id = f.id) AS last_rolled FROM eg_franchises f'
const toFranchise = (r: Row): Franchise => ({ id: Number(r.id), name: String(r.name ?? ''), host: String(r.host ?? ''), ownerEmail: String(r.owner_email ?? ''), status: toStatus(r.status), createdAt: String(r.created_at ?? ''), pages: Number(r.pages ?? 0), lastRolledAt: r.last_rolled ? String(r.last_rolled) : null })

export async function listFranchises(d1: D1): Promise<Franchise[]> {
  return (await all(d1, `${SELECT} ORDER BY f.name COLLATE NOCASE LIMIT 500`)).map(toFranchise)
}
export async function findFranchise(d1: D1, id: number): Promise<Franchise | null> {
  const r = (await all(d1, `${SELECT} WHERE f.id = ?1`, id))[0]
  return r ? toFranchise(r) : null
}
export async function countFranchises(d1: D1): Promise<number> {
  return Number((await all(d1, 'SELECT COUNT(*) AS n FROM eg_franchises'))[0]?.n ?? 0)
}
export async function hostTaken(d1: D1, host: string, exceptId = 0): Promise<boolean> {
  return (await all(d1, 'SELECT id FROM eg_franchises WHERE host = ?1 AND id != ?2', host, exceptId)).length > 0
}
export async function createFranchise(d1: D1, v: { name: string; host: string; ownerEmail: string }, nowIso: string): Promise<number> {
  const res = await d1.prepare('INSERT INTO eg_franchises (name, host, owner_email, status, created_at, updated_at) VALUES (?1,?2,?3,\'active\',?4,?4)').bind(v.name, v.host, v.ownerEmail, nowIso).run()
  return Number(res.meta?.last_row_id ?? 0)
}
export async function updateFranchise(d1: D1, id: number, v: { name: string; ownerEmail: string; status: FranchiseStatus }, nowIso: string): Promise<void> {
  await d1.prepare('UPDATE eg_franchises SET name = ?1, owner_email = ?2, status = ?3, updated_at = ?4 WHERE id = ?5').bind(v.name, v.ownerEmail, v.status, nowIso, id).run()
}
export async function deleteFranchise(d1: D1, id: number): Promise<void> {
  await d1.prepare('DELETE FROM eg_franchise_pages WHERE franchise_id = ?1').bind(id).run()
  await d1.prepare('DELETE FROM eg_franchises WHERE id = ?1').bind(id).run()
}
export async function mappedPageId(d1: D1, franchiseId: number, templateId: number): Promise<number | null> {
  const r = (await all(d1, 'SELECT page_id FROM eg_franchise_pages WHERE franchise_id = ?1 AND template_id = ?2', franchiseId, templateId))[0]
  return r ? Number(r.page_id) : null
}
export async function saveMapping(d1: D1, franchiseId: number, templateId: number, pageId: number, nowIso: string): Promise<void> {
  await d1
    .prepare('INSERT INTO eg_franchise_pages (franchise_id, template_id, page_id, rolled_at) VALUES (?1,?2,?3,?4) ON CONFLICT(franchise_id, template_id) DO UPDATE SET page_id = ?3, rolled_at = ?4')
    .bind(franchiseId, templateId, pageId, nowIso)
    .run()
}
