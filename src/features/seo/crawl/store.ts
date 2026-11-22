import { sql } from 'drizzle-orm'

import type { Drizzle } from '@/localapi/migrate'

import type { StoredPage } from './model'
import { healthScore, linkGraph, siteIssues, type CrawlPage } from './issues'

/**
 * Data access for the site audit crawl: `eg_seo_crawl_runs` (one row per crawl) and `eg_seo_crawl_pages` (one row
 * per address in a crawl). Raw SQL on the same db handle as the other custom tables.
 */

export const KEEP_RUNS = 3
export const MAX_PAGES = 2000

export type CrawlTarget = { path: string; collection: string | null; docId: number | null; inSitemap: boolean }

export type RunRow = {
  id: number
  status: 'running' | 'done'
  source: 'manual' | 'schedule'
  startedAt: string
  finishedAt: string | null
  total: number
  done: number
  health: number | null
  errors: number
  warnings: number
  notices: number
}

export type PageRow = {
  id: number
  path: string
  collection: string | null
  docId: number | null
  inSitemap: boolean
  state: 'pending' | 'done'
  statusCode: number | null
  responseMs: number | null
  redirectTo: string | null
  redirectHops: number
  bytes: number | null
  data: StoredPage | null
  issues: string[]
  depth: number | null
  inLinks: number
  outInternal: number
  outExternal: number
  brokenLinks: number
}

type RawRun = { id: number; status: string; source: string; started_at: string; finished_at: string | null; total: number; done: number; health: number | null; errors: number; warnings: number; notices: number }
type RawPage = {
  id: number; path: string; collection: string | null; doc_id: number | null; in_sitemap: number; state: string; status_code: number | null
  response_ms: number | null; redirect_to: string | null; redirect_hops: number; bytes: number | null; data: string | null; issues: string | null
  depth: number | null; in_links: number; out_internal: number; out_external: number; broken_links: number
}

const parseJson = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback
  try {
    return (JSON.parse(value) as T) ?? fallback
  } catch {
    return fallback
  }
}

const toRun = (r: RawRun): RunRow => ({
  id: Number(r.id), status: r.status === 'done' ? 'done' : 'running', source: r.source === 'schedule' ? 'schedule' : 'manual', startedAt: r.started_at,
  finishedAt: r.finished_at, total: Number(r.total), done: Number(r.done), health: r.health === null ? null : Number(r.health),
  errors: Number(r.errors), warnings: Number(r.warnings), notices: Number(r.notices),
})

const toPage = (r: RawPage): PageRow => ({
  id: Number(r.id), path: r.path, collection: r.collection, docId: r.doc_id === null ? null : Number(r.doc_id), inSitemap: Number(r.in_sitemap) === 1,
  state: r.state === 'done' ? 'done' : 'pending', statusCode: r.status_code, responseMs: r.response_ms, redirectTo: r.redirect_to,
  redirectHops: Number(r.redirect_hops), bytes: r.bytes, data: parseJson<StoredPage | null>(r.data, null), issues: parseJson<string[]>(r.issues, []),
  depth: r.depth, inLinks: Number(r.in_links), outInternal: Number(r.out_internal), outExternal: Number(r.out_external), brokenLinks: Number(r.broken_links),
})

export async function latestRuns(db: Drizzle, limit = 2): Promise<RunRow[]> {
  const rows = (await db.all(sql`SELECT * FROM \`eg_seo_crawl_runs\` ORDER BY id DESC LIMIT ${Math.max(1, Math.min(limit, KEEP_RUNS))}`)) as RawRun[]
  return rows.map(toRun)
}

export async function getRun(db: Drizzle, runId: number): Promise<RunRow | null> {
  const rows = (await db.all(sql`SELECT * FROM \`eg_seo_crawl_runs\` WHERE id = ${runId} LIMIT 1`)) as RawRun[]
  return rows[0] ? toRun(rows[0]) : null
}

export async function listPages(db: Drizzle, runId: number): Promise<PageRow[]> {
  const rows = (await db.all(sql`SELECT * FROM \`eg_seo_crawl_pages\` WHERE run_id = ${runId} ORDER BY id ASC LIMIT ${MAX_PAGES}`)) as RawPage[]
  return rows.map(toPage)
}

/** Starts a run with every target waiting. Old runs beyond the last few are dropped. */
export async function startRun(db: Drizzle, source: 'manual' | 'schedule', targets: CrawlTarget[], now = new Date()): Promise<number> {
  const unique = new Map<string, CrawlTarget>()
  for (const t of targets) if (!unique.has(t.path)) unique.set(t.path, t)
  const list = [...unique.values()].slice(0, MAX_PAGES)
  await db.run(sql`INSERT INTO \`eg_seo_crawl_runs\` (status, source, started_at, total, done) VALUES ('running', ${source}, ${now.toISOString()}, ${list.length}, 0)`)
  const idRow = (await db.all(sql`SELECT last_insert_rowid() AS id`)) as { id: number }[]
  const runId = Number(idRow[0]?.id ?? 0)
  for (const t of list) {
    await db.run(sql`INSERT INTO \`eg_seo_crawl_pages\` (run_id, path, collection, doc_id, in_sitemap) VALUES (${runId}, ${t.path}, ${t.collection}, ${t.docId}, ${t.inSitemap ? 1 : 0})`)
  }
  await db.run(sql`DELETE FROM \`eg_seo_crawl_pages\` WHERE run_id NOT IN (SELECT id FROM \`eg_seo_crawl_runs\` ORDER BY id DESC LIMIT ${KEEP_RUNS})`)
  await db.run(sql`DELETE FROM \`eg_seo_crawl_runs\` WHERE id NOT IN (SELECT id FROM \`eg_seo_crawl_runs\` ORDER BY id DESC LIMIT ${KEEP_RUNS})`)
  return runId
}

export async function pendingPages(db: Drizzle, runId: number, limit: number): Promise<PageRow[]> {
  const rows = (await db.all(sql`SELECT * FROM \`eg_seo_crawl_pages\` WHERE run_id = ${runId} AND state = 'pending' ORDER BY id ASC LIMIT ${Math.max(1, Math.min(limit, 50))}`)) as RawPage[]
  return rows.map(toPage)
}

export type PageResult = {
  statusCode: number
  responseMs: number
  redirectTo: string | null
  redirectHops: number
  bytes: number | null
  data: StoredPage | null
  issues: string[]
}

export async function savePage(db: Drizzle, pageId: number, result: PageResult): Promise<void> {
  await db.run(sql`UPDATE \`eg_seo_crawl_pages\` SET state = 'done', status_code = ${result.statusCode}, response_ms = ${result.responseMs}, redirect_to = ${result.redirectTo},
    redirect_hops = ${result.redirectHops}, bytes = ${result.bytes}, data = ${result.data ? JSON.stringify(result.data) : null}, issues = ${JSON.stringify(result.issues)} WHERE id = ${pageId}`)
}

export async function countDone(db: Drizzle, runId: number): Promise<{ done: number; total: number }> {
  const rows = (await db.all(sql`SELECT SUM(CASE WHEN state = 'done' THEN 1 ELSE 0 END) AS done, COUNT(*) AS total FROM \`eg_seo_crawl_pages\` WHERE run_id = ${runId}`)) as { done: number | null; total: number }[]
  const done = Number(rows[0]?.done ?? 0)
  await db.run(sql`UPDATE \`eg_seo_crawl_runs\` SET done = ${done} WHERE id = ${runId}`)
  return { done, total: Number(rows[0]?.total ?? 0) }
}

/** Page issues were saved per page; the link graph and the checks that compare pages are worked out here, once. */
export async function finishRun(db: Drizzle, runId: number, origin: string, now = new Date()): Promise<RunRow | null> {
  const rows = await listPages(db, runId)
  const pages: CrawlPage[] = rows.map((r) => ({
    path: r.path, statusCode: r.statusCode ?? 0, responseMs: r.responseMs ?? 0, redirectTo: r.redirectTo, redirectHops: r.redirectHops,
    inSitemap: r.inSitemap, facts: r.data, depth: null as number | null, inLinks: 0, outInternal: 0, outExternal: 0, brokenLinks: 0,
  }))
  linkGraph(pages, origin)
  const cross = siteIssues(pages, origin)
  const all: string[][] = []
  for (let i = 0; i < rows.length; i++) {
    const page = pages[i]
    // Graph checks that need no second look at the HTML: re-run only the ones fed by the graph.
    const own = rows[i].issues.filter((id) => id !== 'broken-internal-links')
    const merged = [...own, ...(page.brokenLinks > 0 ? ['broken-internal-links'] : []), ...(cross.get(page.path) ?? [])]
    all.push(merged)
    await db.run(sql`UPDATE \`eg_seo_crawl_pages\` SET issues = ${JSON.stringify(merged)}, depth = ${page.depth}, in_links = ${page.inLinks}, out_internal = ${page.outInternal},
      out_external = ${page.outExternal}, broken_links = ${page.brokenLinks} WHERE id = ${rows[i].id}`)
  }
  const health = healthScore(all.filter((_, i) => rows[i].statusCode !== null))
  await db.run(sql`UPDATE \`eg_seo_crawl_runs\` SET status = 'done', finished_at = ${now.toISOString()}, done = ${rows.length}, health = ${health.score}, errors = ${health.errors},
    warnings = ${health.warnings}, notices = ${health.notices} WHERE id = ${runId}`)
  return getRun(db, runId)
}

export async function readSchedule(db: Drizzle): Promise<'off' | 'daily' | 'weekly'> {
  const rows = (await db.all(sql`SELECT schedule FROM \`eg_seo_crawl_config\` WHERE id = 1`)) as { schedule: string }[]
  const value = rows[0]?.schedule
  return value === 'daily' || value === 'weekly' ? value : 'off'
}

export async function writeSchedule(db: Drizzle, schedule: 'off' | 'daily' | 'weekly'): Promise<void> {
  await db.run(sql`INSERT INTO \`eg_seo_crawl_config\` (id, schedule) VALUES (1, ${schedule}) ON CONFLICT(id) DO UPDATE SET schedule = excluded.schedule`)
}

/** True when a scheduled crawl is due: a schedule is set and the last run started longer ago than its interval. */
export function scheduleDue(schedule: 'off' | 'daily' | 'weekly', lastStartedAt: string | null, now: Date): boolean {
  if (schedule === 'off') return false
  if (!lastStartedAt) return true
  const hours = schedule === 'daily' ? 23 : 24 * 7 - 1
  return now.getTime() - new Date(lastStartedAt).getTime() >= hours * 3600_000
}


/** What the newest finished crawl found for one address: its failed checks and the internal links it makes that lead to error pages. */
export async function crawlFindingsFor(db: Drizzle, path: string): Promise<{ at: string; issues: string[]; brokenLinks: string[] } | null> {
  const runs = (await db.all(sql`SELECT * FROM \`eg_seo_crawl_runs\` WHERE status = 'done' ORDER BY id DESC LIMIT 1`)) as RawRun[]
  const run = runs[0]
  if (!run) return null
  const own = (await db.all(sql`SELECT * FROM \`eg_seo_crawl_pages\` WHERE run_id = ${run.id} AND path = ${path} LIMIT 1`)) as RawPage[]
  if (!own[0]) return null
  const page = toPage(own[0])
  const bad = (await db.all(sql`SELECT path FROM \`eg_seo_crawl_pages\` WHERE run_id = ${run.id} AND status_code >= 400`)) as { path: string }[]
  const badPaths = new Set(bad.map((b) => b.path))
  const hrefs = (page.data?.links ?? []).map((l) => l.href.split('#')[0].split('?')[0].replace(/^https?:\/\/[^/]+/i, '') || '/')
  return { at: run.finished_at ?? run.started_at, issues: page.issues, brokenLinks: [...new Set(hrefs.filter((h) => badPaths.has(h.length > 1 ? h.replace(/\/$/, '') : h)))] }
}

export type CrawlOverview = { snippets: string[]; issues: number; brokenLinks: number }

/** What the newest finished crawl found for a set of documents of one collection, keyed by document id. Empty when there is no crawl. */
export async function crawlOverviewFor(db: Drizzle, collection: string, ids: number[]): Promise<Map<number, CrawlOverview>> {
  const out = new Map<number, CrawlOverview>()
  const wanted = [...new Set(ids.filter((n) => Number.isInteger(n)))].slice(0, 200)
  if (wanted.length === 0) return out
  const runs = (await db.all(sql`SELECT id FROM \`eg_seo_crawl_runs\` WHERE status = 'done' ORDER BY id DESC LIMIT 1`)) as { id: number }[]
  if (!runs[0]) return out
  const rows = (await db.all(sql`SELECT * FROM \`eg_seo_crawl_pages\` WHERE run_id = ${runs[0].id} AND collection = ${collection} AND doc_id IN (${sql.join(wanted.map((n) => sql`${n}`), sql`, `)})`)) as RawPage[]
  for (const raw of rows) {
    const page = toPage(raw)
    if (page.docId !== null) out.set(page.docId, { snippets: page.data?.snippetTypes ?? [], issues: page.issues.length, brokenLinks: page.brokenLinks })
  }
  return out
}
