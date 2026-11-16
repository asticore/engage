import { normalisePlan, type Plan } from './plan'

type Stmt = { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<{ meta?: { last_row_id?: number } }> } }
export type D1 = { prepare: (sql: string) => Stmt }
type Row = Record<string, unknown>

export type SavedPlan = { id: number; name: string; idea: string; answers: string; plan: Plan; updatedAt: string }

const all = async (d1: D1, sql: string, ...args: unknown[]): Promise<Row[]> => (await d1.prepare(sql).bind(...args).all<Row>()).results
const toPlan = (text: unknown): Plan => {
  try {
    return normalisePlan(JSON.parse(String(text ?? '')))
  } catch {
    return { pages: [] }
  }
}
const toSaved = (r: Row): SavedPlan => ({ id: Number(r.id), name: String(r.name ?? ''), idea: String(r.idea ?? ''), answers: String(r.answers ?? ''), plan: toPlan(r.plan), updatedAt: String(r.updated_at ?? '') })

export async function listPlans(d1: D1): Promise<Array<Pick<SavedPlan, 'id' | 'name' | 'updatedAt'> & { pages: number }>> {
  return (await all(d1, 'SELECT id, name, plan, updated_at FROM eg_site_plans ORDER BY updated_at DESC LIMIT 100')).map((r) => ({ id: Number(r.id), name: String(r.name ?? ''), updatedAt: String(r.updated_at ?? ''), pages: toPlan(r.plan).pages.length }))
}
export async function getPlan(d1: D1, id: number): Promise<SavedPlan | null> {
  const rows = await all(d1, 'SELECT id, name, idea, answers, plan, updated_at FROM eg_site_plans WHERE id = ?1', id)
  return rows[0] ? toSaved(rows[0]) : null
}
export async function savePlan(d1: D1, id: number | null, v: { name: string; idea: string; answers: string; plan: Plan }, nowIso: string): Promise<number> {
  const planText = JSON.stringify(v.plan)
  if (id) {
    await d1.prepare('UPDATE eg_site_plans SET name=?1, idea=?2, answers=?3, plan=?4, updated_at=?5 WHERE id=?6').bind(v.name, v.idea, v.answers, planText, nowIso, id).run()
    return id
  }
  const res = await d1.prepare('INSERT INTO eg_site_plans (name, idea, answers, plan, updated_at, created_at) VALUES (?1,?2,?3,?4,?5,?5)').bind(v.name, v.idea, v.answers, planText, nowIso).run()
  return Number(res.meta?.last_row_id ?? 0)
}
export async function deletePlan(d1: D1, id: number): Promise<void> {
  await d1.prepare('DELETE FROM eg_site_plans WHERE id = ?1').bind(id).run()
}
