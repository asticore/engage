import { parseSections, toCadence, toDay, toPreset, type Cadence, type Preset, type SectionKey } from './core'

type Stmt = { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<{ meta?: { last_row_id?: number } }> } }
export type D1 = { prepare: (sql: string) => Stmt }
type Row = Record<string, unknown>

export type ClientReport = { id: number; name: string; token: string; preset: Preset; recipients: string; cadence: Cadence; lastSentAt: string | null; revoked: boolean; createdAt: string; sections: SectionKey[]; rangeFrom: string; rangeTo: string }

const all = async (d1: D1, sql: string, ...args: unknown[]): Promise<Row[]> => (await d1.prepare(sql).bind(...args).all<Row>()).results
const toReport = (r: Row): ClientReport => ({ id: Number(r.id), name: String(r.name ?? ''), token: String(r.token ?? ''), preset: toPreset(r.preset), recipients: String(r.recipients ?? ''), cadence: toCadence(r.cadence), lastSentAt: r.last_sent_at ? String(r.last_sent_at) : null, revoked: Number(r.revoked ?? 0) === 1, createdAt: String(r.created_at ?? ''), sections: parseSections(r.sections), rangeFrom: toDay(r.range_from), rangeTo: toDay(r.range_to) })

const COLS = 'id, name, token, preset, recipients, cadence, last_sent_at, revoked, created_at, sections, range_from, range_to'

export async function listReports(d1: D1): Promise<ClientReport[]> {
  return (await all(d1, `SELECT ${COLS} FROM eg_client_reports ORDER BY created_at DESC LIMIT 200`)).map(toReport)
}
export async function countReports(d1: D1): Promise<number> {
  return Number((await all(d1, 'SELECT COUNT(*) AS n FROM eg_client_reports'))[0]?.n ?? 0)
}
export async function findByToken(d1: D1, token: string): Promise<ClientReport | null> {
  const r = (await all(d1, `SELECT ${COLS} FROM eg_client_reports WHERE token = ?1 AND revoked = 0`, token))[0]
  return r ? toReport(r) : null
}
export async function findById(d1: D1, id: number): Promise<ClientReport | null> {
  const r = (await all(d1, `SELECT ${COLS} FROM eg_client_reports WHERE id = ?1`, id))[0]
  return r ? toReport(r) : null
}
export type ReportOptions = { sections: SectionKey[]; rangeFrom: string; rangeTo: string }
export async function createReport(d1: D1, v: { name: string; token: string; preset: Preset; recipients: string; cadence: Cadence } & ReportOptions, nowIso: string): Promise<number> {
  const res = await d1.prepare('INSERT INTO eg_client_reports (name, token, preset, recipients, cadence, sections, range_from, range_to, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?9)').bind(v.name, v.token, v.preset, v.recipients, v.cadence, v.sections.join(','), v.rangeFrom, v.rangeTo, nowIso).run()
  return Number(res.meta?.last_row_id ?? 0)
}
export async function updateReport(d1: D1, id: number, v: { name: string; preset: Preset; recipients: string; cadence: Cadence } & ReportOptions, nowIso: string): Promise<void> {
  await d1.prepare('UPDATE eg_client_reports SET name = ?1, preset = ?2, recipients = ?3, cadence = ?4, sections = ?5, range_from = ?6, range_to = ?7, updated_at = ?8 WHERE id = ?9').bind(v.name, v.preset, v.recipients, v.cadence, v.sections.join(','), v.rangeFrom, v.rangeTo, nowIso, id).run()
}
export async function setRevoked(d1: D1, id: number, revoked: boolean, nowIso: string): Promise<void> {
  await d1.prepare('UPDATE eg_client_reports SET revoked = ?1, updated_at = ?2 WHERE id = ?3').bind(revoked ? 1 : 0, nowIso, id).run()
}
export async function rotateToken(d1: D1, id: number, token: string, nowIso: string): Promise<void> {
  await d1.prepare('UPDATE eg_client_reports SET token = ?1, revoked = 0, updated_at = ?2 WHERE id = ?3').bind(token, nowIso, id).run()
}
export async function markSent(d1: D1, id: number, nowIso: string): Promise<void> {
  await d1.prepare('UPDATE eg_client_reports SET last_sent_at = ?1 WHERE id = ?2').bind(nowIso, id).run()
}
export async function deleteReport(d1: D1, id: number): Promise<void> {
  await d1.prepare('DELETE FROM eg_client_reports WHERE id = ?1').bind(id).run()
}
