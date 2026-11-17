import type { IpRule, IpRuleKind } from './ipRules'

type Stmt = { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<unknown> }; all: <T>() => Promise<{ results: T[] }> }
export type D1 = { prepare: (sql: string) => Stmt }
type Row = Record<string, unknown>

const toRule = (r: Row): IpRule => ({ id: Number(r.id), kind: (['allow', 'country-allow', 'country-block', 'message'].includes(String(r.kind)) ? String(r.kind) : 'block') as IpRuleKind, entry: String(r.entry ?? ''), reason: String(r.reason ?? ''), expiresAt: r.expires_at ? String(r.expires_at) : null, createdAt: String(r.created_at ?? '') })

export async function listRules(d1: D1): Promise<IpRule[]> {
  const res = await d1.prepare('SELECT id, kind, entry, reason, expires_at, created_at FROM eg_ip_rules ORDER BY id DESC LIMIT 2000').all<Row>()
  return res.results.map(toRule)
}

export async function addRule(d1: D1, v: { kind: IpRuleKind; entry: string; reason: string; expiresAt: string | null }, nowIso: string): Promise<void> {
  await d1.prepare('INSERT OR IGNORE INTO eg_ip_rules (kind, entry, reason, expires_at, created_at) VALUES (?1,?2,?3,?4,?5)').bind(v.kind, v.entry, v.reason, v.expiresAt, nowIso).run()
}

/** Replaces the whole country list (allow or block mode) with the given codes. An empty list clears both. */
export async function setCountries(d1: D1, kind: 'country-allow' | 'country-block' | null, codes: string[], nowIso: string): Promise<void> {
  await d1.prepare("DELETE FROM eg_ip_rules WHERE kind IN ('country-allow','country-block')").bind().run()
  if (!kind) return
  for (const code of codes) await d1.prepare('INSERT OR IGNORE INTO eg_ip_rules (kind, entry, reason, expires_at, created_at) VALUES (?1,?2,\'\',NULL,?3)').bind(kind, code, nowIso).run()
}

/** Replaces the custom block message. Empty text removes it. */
export async function setMessage(d1: D1, text: string, nowIso: string): Promise<void> {
  await d1.prepare("DELETE FROM eg_ip_rules WHERE kind = 'message'").bind().run()
  if (text) await d1.prepare("INSERT OR IGNORE INTO eg_ip_rules (kind, entry, reason, expires_at, created_at) VALUES ('message',?1,'',NULL,?2)").bind(text, nowIso).run()
}

export async function deleteRules(d1: D1, ids: number[]): Promise<void> {
  for (const id of ids.slice(0, 500)) await d1.prepare('DELETE FROM eg_ip_rules WHERE id = ?1').bind(id).run()
}

/** The middleware reader: one SELECT held in isolate memory for 30 seconds. Fails open to no rules. */
let cached: { at: number; rules: IpRule[] } | null = null
export function resetIpRulesCache(): void {
  cached = null
}

export async function readIpRulesCached(): Promise<IpRule[]> {
  const now = Date.now()
  if (cached && now - cached.at < 30_000) return cached.rules
  let rules: IpRule[] = []
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const context = await getCloudflareContext({ async: true })
    const d1 = context?.env?.D1 as unknown as D1 | undefined
    if (d1) rules = await listRules(d1)
  } catch {
    rules = []
  }
  cached = { at: now, rules }
  return rules
}
