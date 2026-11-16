import { agentDay, type AgentAction, type AgentGrant } from './core'

type Stmt = { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<{ meta?: { last_row_id?: number; changes?: number } }> } }
export type D1 = { prepare: (sql: string) => Stmt }
type Row = Record<string, unknown>

const all = async (d1: D1, sql: string, ...args: unknown[]): Promise<Row[]> => (await d1.prepare(sql).bind(...args).all<Row>()).results ?? []
const run = async (d1: D1, sql: string, ...args: unknown[]): Promise<number> => Number((await d1.prepare(sql).bind(...args).run()).meta?.changes ?? 0)

const toGrant = (r: Row): AgentGrant => ({
  id: Number(r.id),
  keyId: Number(r.key_id),
  label: String(r.label ?? ''),
  tool: String(r.tool ?? ''),
  dailyWriteCap: Number(r.daily_write_cap ?? 0),
  dailyReadCap: Number(r.daily_read_cap ?? 0),
  createdBy: r.created_by === null || r.created_by === undefined ? null : Number(r.created_by),
  createdAt: String(r.created_at ?? ''),
  revokedAt: r.revoked_at ? String(r.revoked_at) : null,
})

export async function grantForKey(d1: D1, keyId: number): Promise<AgentGrant | null> {
  const r = (await all(d1, 'SELECT * FROM eg_agent_grants WHERE key_id = ?1 LIMIT 1', keyId))[0]
  return r ? toGrant(r) : null
}

export async function listGrants(d1: D1): Promise<AgentGrant[]> {
  return (await all(d1, 'SELECT * FROM eg_agent_grants ORDER BY id DESC')).map(toGrant)
}

export async function insertGrant(
  d1: D1,
  g: { keyId: number; label: string; tool: string; dailyWriteCap: number; dailyReadCap: number; createdBy: number | null },
  nowIso: string,
): Promise<number> {
  const res = await d1
    .prepare('INSERT INTO eg_agent_grants (key_id, label, tool, daily_write_cap, daily_read_cap, created_by, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)')
    .bind(g.keyId, g.label, g.tool, g.dailyWriteCap, g.dailyReadCap, g.createdBy, nowIso)
    .run()
  return Number(res.meta?.last_row_id ?? 0)
}

export async function updateCaps(d1: D1, id: number, dailyWriteCap: number, dailyReadCap: number): Promise<boolean> {
  return (await run(d1, 'UPDATE eg_agent_grants SET daily_write_cap = ?1, daily_read_cap = ?2 WHERE id = ?3', dailyWriteCap, dailyReadCap, id)) > 0
}

export async function revokeGrant(d1: D1, id: number, nowIso: string): Promise<boolean> {
  return (await run(d1, 'UPDATE eg_agent_grants SET revoked_at = ?1 WHERE id = ?2 AND revoked_at IS NULL', nowIso, id)) > 0
}

/** Requests already counted for a grant on one UTC day. Capped requests are logged but never counted. */
export async function countedToday(d1: D1, grantId: number, ms: number): Promise<{ reads: number; writes: number }> {
  const rows = await all(d1, "SELECT kind, COUNT(*) AS n FROM eg_agent_actions WHERE grant_id = ?1 AND day = ?2 AND outcome = 'allowed' GROUP BY kind", grantId, agentDay(ms))
  let reads = 0
  let writes = 0
  for (const r of rows) {
    if (r.kind === 'read') reads = Number(r.n)
    if (r.kind === 'write') writes = Number(r.n)
  }
  return { reads, writes }
}

export async function logAction(
  d1: D1,
  a: { grantId: number; keyId: number; kind: 'read' | 'write' | 'other'; method: string; path: string; outcome: AgentAction['outcome'] },
  ms: number,
): Promise<void> {
  await d1
    .prepare('INSERT INTO eg_agent_actions (grant_id, key_id, at, day, kind, method, path, outcome) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)')
    .bind(a.grantId, a.keyId, new Date(ms).toISOString(), agentDay(ms), a.kind, a.method, a.path, a.outcome)
    .run()
}

export async function recentActions(d1: D1, grantId: number | null, limit = 100): Promise<AgentAction[]> {
  const rows = grantId
    ? await all(d1, 'SELECT * FROM eg_agent_actions WHERE grant_id = ?1 ORDER BY id DESC LIMIT ?2', grantId, limit)
    : await all(d1, 'SELECT * FROM eg_agent_actions ORDER BY id DESC LIMIT ?1', limit)
  return rows.map((r) => ({
    id: Number(r.id),
    grantId: Number(r.grant_id),
    keyId: Number(r.key_id),
    at: String(r.at ?? ''),
    method: String(r.method ?? ''),
    path: String(r.path ?? ''),
    outcome: (r.outcome === 'capped' || r.outcome === 'refused' ? r.outcome : 'allowed') as AgentAction['outcome'],
  }))
}

export async function todayTotals(d1: D1, ms: number): Promise<Record<number, { reads: number; writes: number }>> {
  const rows = await all(d1, "SELECT grant_id, kind, COUNT(*) AS n FROM eg_agent_actions WHERE day = ?1 AND outcome = 'allowed' GROUP BY grant_id, kind", agentDay(ms))
  const out: Record<number, { reads: number; writes: number }> = {}
  for (const r of rows) {
    const id = Number(r.grant_id)
    out[id] ??= { reads: 0, writes: 0 }
    if (r.kind === 'read') out[id].reads = Number(r.n)
    if (r.kind === 'write') out[id].writes = Number(r.n)
  }
  return out
}

export async function purgeOlderThan(d1: D1, cutoffIso: string): Promise<number> {
  return run(d1, 'DELETE FROM eg_agent_actions WHERE at < ?1', cutoffIso)
}

/** Privacy erase: the owner's keys are deleted elsewhere; their grants and logs go too. */
export async function eraseForUser(d1: D1, userId: number): Promise<number> {
  const ids = 'SELECT id FROM eg_agent_grants WHERE key_id IN (SELECT id FROM eg_api_keys WHERE user_id = ?1)'
  const n = await run(d1, `DELETE FROM eg_agent_actions WHERE grant_id IN (${ids})`, userId)
  return n + (await run(d1, 'DELETE FROM eg_agent_grants WHERE key_id IN (SELECT id FROM eg_api_keys WHERE user_id = ?1)', userId))
}
