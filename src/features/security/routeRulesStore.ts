import type { RateRule } from './routeRules'

type Stmt = { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<unknown> }; all: <T>() => Promise<{ results: T[] }> }
export type D1 = { prepare: (sql: string) => Stmt }
type Row = Record<string, unknown>

const toRule = (r: Row): RateRule => ({ id: Number(r.id), pathPrefix: String(r.path_prefix ?? ''), method: String(r.method ?? 'ANY'), limit: Number(r.max_requests ?? 0), windowSeconds: Number(r.window_seconds ?? 60), note: String(r.note ?? ''), enabled: Number(r.enabled ?? 1) !== 0 })

export async function listRateRules(d1: D1): Promise<RateRule[]> {
  return (await d1.prepare('SELECT id, path_prefix, method, max_requests, window_seconds, note, enabled FROM eg_rate_rules ORDER BY id DESC LIMIT 500').all<Row>()).results.map(toRule)
}

export async function addRateRule(d1: D1, r: Omit<RateRule, 'id'>, nowIso: string): Promise<void> {
  await d1.prepare('INSERT INTO eg_rate_rules (path_prefix, method, max_requests, window_seconds, note, enabled, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)').bind(r.pathPrefix, r.method, r.limit, r.windowSeconds, r.note, r.enabled ? 1 : 0, nowIso).run()
}

export async function setRateRuleEnabled(d1: D1, id: number, enabled: boolean): Promise<void> {
  await d1.prepare('UPDATE eg_rate_rules SET enabled = ?1 WHERE id = ?2').bind(enabled ? 1 : 0, id).run()
}

export async function deleteRateRule(d1: D1, id: number): Promise<void> {
  await d1.prepare('DELETE FROM eg_rate_rules WHERE id = ?1').bind(id).run()
}

/** The middleware reader: one SELECT held in isolate memory for 30 seconds. Fails open to no rules. */
let cached: { at: number; rules: RateRule[] } | null = null
export function resetRateRulesCache(): void {
  cached = null
}

export async function readRateRulesCached(): Promise<RateRule[]> {
  const now = Date.now()
  if (cached && now - cached.at < 30_000) return cached.rules
  let rules: RateRule[] = []
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const context = await getCloudflareContext({ async: true })
    const d1 = context?.env?.D1 as unknown as D1 | undefined
    if (d1) rules = await listRateRules(d1)
  } catch {
    rules = []
  }
  cached = { at: now, rules }
  return rules
}
