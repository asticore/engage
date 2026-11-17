import { EMPTY_CSP_BUILDER, normaliseConfig, type CspBuilderConfig, type Violation } from './cspBuilder'

type Stmt = { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<unknown> }; all: <T>() => Promise<{ results: T[] }> }
export type D1 = { prepare: (sql: string) => Stmt }
type Row = Record<string, unknown>

/** The log keeps this many distinct (directive, blocked) rows; a flood of random hosts cannot grow it further. */
export const MAX_REPORT_ROWS = 300

export type StoredViolation = Violation & { id: number; hits: number; firstSeen: string; lastSeen: string }

export async function readConfig(d1: D1): Promise<CspBuilderConfig> {
  const res = await d1.prepare('SELECT config FROM eg_csp_builder WHERE id = 1').all<Row>()
  const raw = res.results[0]?.config
  if (typeof raw !== 'string') return EMPTY_CSP_BUILDER
  try {
    return normaliseConfig(JSON.parse(raw))
  } catch {
    return EMPTY_CSP_BUILDER
  }
}

export async function saveConfig(d1: D1, config: CspBuilderConfig, nowIso: string): Promise<void> {
  await d1
    .prepare('INSERT INTO eg_csp_builder (id, config, updated_at) VALUES (1, ?1, ?2) ON CONFLICT(id) DO UPDATE SET config = excluded.config, updated_at = excluded.updated_at')
    .bind(JSON.stringify(config), nowIso)
    .run()
}

const toStored = (r: Row): StoredViolation => ({
  id: Number(r.id),
  directive: String(r.directive ?? ''),
  blocked: String(r.blocked ?? ''),
  page: String(r.page ?? ''),
  disposition: r.disposition === 'report' ? 'report' : 'enforce',
  hits: Number(r.hits ?? 1),
  firstSeen: String(r.first_seen ?? ''),
  lastSeen: String(r.last_seen ?? ''),
})

export async function listViolations(d1: D1): Promise<StoredViolation[]> {
  const res = await d1.prepare('SELECT id, directive, blocked, page, disposition, hits, first_seen, last_seen FROM eg_csp_reports ORDER BY last_seen DESC, id DESC LIMIT 300').all<Row>()
  return res.results.map(toStored)
}

/** Counts a violation: a repeat of (directive, blocked) bumps the hit count and the last page; new ones stop at the cap. */
export async function recordViolations(d1: D1, violations: Violation[], nowIso: string): Promise<number> {
  if (violations.length === 0) return 0
  const count = await d1.prepare('SELECT COUNT(*) AS n FROM eg_csp_reports').all<Row>()
  let room = MAX_REPORT_ROWS - Number(count.results[0]?.n ?? 0)
  let stored = 0
  for (const v of violations) {
    const existing = await d1.prepare('SELECT id FROM eg_csp_reports WHERE directive = ?1 AND blocked = ?2').bind(v.directive, v.blocked).all<Row>()
    if (existing.results.length) {
      await d1.prepare('UPDATE eg_csp_reports SET hits = hits + 1, page = ?1, disposition = ?2, last_seen = ?3 WHERE id = ?4').bind(v.page, v.disposition, nowIso, Number(existing.results[0].id)).run()
      stored += 1
    } else if (room > 0) {
      await d1
        .prepare('INSERT OR IGNORE INTO eg_csp_reports (directive, blocked, page, disposition, hits, first_seen, last_seen) VALUES (?1,?2,?3,?4,1,?5,?5)')
        .bind(v.directive, v.blocked, v.page, v.disposition, nowIso)
        .run()
      room -= 1
      stored += 1
    }
  }
  return stored
}

export async function deleteViolations(d1: D1, ids: number[] | 'all'): Promise<void> {
  if (ids === 'all') {
    await d1.prepare('DELETE FROM eg_csp_reports').bind().run()
    return
  }
  for (const id of ids.slice(0, 300)) await d1.prepare('DELETE FROM eg_csp_reports WHERE id = ?1').bind(id).run()
}

// The middleware reader: one SELECT held in isolate memory for 30 seconds. Fails open to "builder off".
let cached: { at: number; config: CspBuilderConfig } | null = null

export function resetCspBuilderCache(): void {
  cached = null
}

/** The last value read, synchronously: header building is sync and must never wait on the database. */
export function currentCspBuilder(): CspBuilderConfig {
  return cached?.config ?? EMPTY_CSP_BUILDER
}

export async function refreshCspBuilder(): Promise<CspBuilderConfig> {
  const now = Date.now()
  if (cached && now - cached.at < 30_000) return cached.config
  let config = EMPTY_CSP_BUILDER
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const context = await getCloudflareContext({ async: true })
    const d1 = context?.env?.D1 as unknown as D1 | undefined
    if (d1) config = await readConfig(d1)
  } catch {
    config = EMPTY_CSP_BUILDER
  }
  cached = { at: now, config }
  return config
}
