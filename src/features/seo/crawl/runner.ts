import type { Drizzle } from '@/localapi/migrate'

import { parseHtmlFacts } from './htmlFacts'
import { pageIssues } from './issues'
import { toStoredPage } from './model'
import { countDone, finishRun, pendingPages, savePage, startRun, type CrawlTarget, type PageResult, type PageRow, type RunRow } from './store'

/**
 * Runs the site audit crawl of our own pages. The crawl is stepwise so it fits a Worker request: `startCrawl` lists
 * the addresses (the sitemap plus every published page) and `crawlStep` fetches the next few. The admin screen and the
 * scheduled job both call `crawlStep` until nothing is pending, then `finishRun` works out the checks between pages.
 */

export const STEP_PAGES = 8
const FETCH_TIMEOUT_MS = 10_000
const MAX_HOPS = 5
const MAX_HTML_BYTES = 1_500_000

type FetchLike = (input: string, init?: { signal?: AbortSignal; method?: string; redirect?: 'manual'; headers?: Record<string, string> }) => Promise<Response>

type EngineLike = {
  find: (args: Record<string, unknown>) => Promise<{ docs: unknown[] }>
}

const normalise = (path: string): string => {
  const clean = path.split('#')[0]
  return clean.length > 1 ? clean.replace(/\/$/, '') : clean || '/'
}

/** The addresses to crawl: the home page, every sitemap entry and every published page (so hidden pages are seen too). */
export async function collectTargets(
  engine: EngineLike,
  origin: string,
  sitemapUrls: string[],
  pagePaths: (docs: Record<string, unknown>[]) => Promise<{ path: string; id: number }[]>,
): Promise<CrawlTarget[]> {
  const host = new URL(origin).host
  const targets = new Map<string, CrawlTarget>()
  const add = (path: string, collection: string | null, docId: number | null, inSitemap: boolean): void => {
    const key = normalise(path)
    const existing = targets.get(key)
    if (existing) {
      existing.inSitemap = existing.inSitemap || inSitemap
      existing.collection = existing.collection ?? collection
      existing.docId = existing.docId ?? docId
      return
    }
    targets.set(key, { path: key, collection, docId, inSitemap })
  }
  add('/', null, null, false)
  for (const raw of sitemapUrls) {
    try {
      const url = new URL(raw, origin)
      if (url.host !== host) continue
      add(url.pathname, null, null, true)
    } catch {
      // A malformed sitemap address is skipped.
    }
  }
  const { docs } = await engine.find({ collection: 'pages', where: { _status: { equals: 'published' } }, limit: 500, depth: 0, overrideAccess: true })
  for (const entry of await pagePaths(docs as Record<string, unknown>[])) add(entry.path, 'pages', entry.id, false)
  // The home page is the page marked as the home page; only the sitemap tells us it is listed.
  return [...targets.values()]
}

async function fetchOnce(fetchImpl: FetchLike, url: string): Promise<{ response: Response; ms: number }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  const started = Date.now()
  try {
    const response = await fetchImpl(url, { signal: controller.signal, redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 (compatible; SiteAuditCrawler/1.0)', accept: 'text/html,application/xhtml+xml' } })
    return { response, ms: Date.now() - started }
  } finally {
    clearTimeout(timer)
  }
}

const MAX_IMAGE_CHECKS = 6

/** The Last-Modified header as an ISO date, or null when missing or not a date. */
export function lastModifiedOf(value: string | null): string | null {
  if (!value) return null
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

/** File sizes of the first same-site images (HEAD requests, content-length), total and largest. Null when none could be measured. */
export async function imageSizes(origin: string, images: { src: string }[], fetchImpl: FetchLike): Promise<{ imageBytes: number | null; largestImageBytes: number | null }> {
  const own = new URL(origin)
  const urls = new Set<string>()
  for (const img of images) {
    try {
      const u = new URL(img.src, origin)
      if (u.host === own.host && /^https?:$/.test(u.protocol)) urls.add(u.toString())
    } catch {
      // ignore an unusable address
    }
    if (urls.size >= MAX_IMAGE_CHECKS) break
  }
  const sizes = await Promise.all(
    [...urls].map(async (u) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 3000)
      try {
        const r = await fetchImpl(u, { signal: controller.signal, method: 'HEAD', headers: { 'user-agent': 'Mozilla/5.0 (compatible; SiteAuditCrawler/1.0)' } })
        const n = Number(r.headers.get('content-length'))
        return r.ok && Number.isFinite(n) && n > 0 ? n : null
      } catch {
        return null
      } finally {
        clearTimeout(timer)
      }
    }),
  )
  const known = sizes.filter((n): n is number => n !== null)
  return known.length ? { imageBytes: known.reduce((a, b) => a + b, 0), largestImageBytes: Math.max(...known) } : { imageBytes: null, largestImageBytes: null }
}

/** Reads at most `max` characters of the body; longer pages are cut (the facts come from the start of the page). */
async function readText(response: Response, max: number): Promise<string> {
  const text = await response.text()
  return text.length > max ? text.slice(0, max) : text
}

/** Fetches one address, following redirects by hand so the chain and the response time of the first answer are known. */
export async function crawlOne(origin: string, path: string, inSitemap: boolean, fetchImpl: FetchLike = (u, i) => fetch(u, i)): Promise<PageResult> {
  const own = new URL(origin)
  let url = new URL(path, origin).toString()
  const seen = new Set<string>([url])
  let hops = 0
  let firstStatus = 0
  let firstMs = 0
  let redirectTo: string | null = null
  try {
    for (;;) {
      const { response, ms } = await fetchOnce(fetchImpl, url)
      if (hops === 0) {
        firstStatus = response.status
        firstMs = ms
      }
      const location = response.headers.get('location')
      if (response.status >= 300 && response.status < 400 && location) {
        await response.body?.cancel().catch((): void => undefined)
        const next = new URL(location, url)
        if (hops === 0) redirectTo = next.host === own.host ? normalise(next.pathname) : next.toString()
        hops += 1
        const nextUrl = next.toString()
        if (seen.has(nextUrl) || hops >= MAX_HOPS) return { statusCode: firstStatus, responseMs: firstMs, redirectTo, redirectHops: seen.has(nextUrl) ? 10 : hops, bytes: null, data: null, issues: [seen.has(nextUrl) ? 'redirect-loop' : 'redirect-chain'] }
        if (next.host !== own.host) return { statusCode: firstStatus, responseMs: firstMs, redirectTo, redirectHops: hops, bytes: null, data: null, issues: [] }
        seen.add(nextUrl)
        url = nextUrl
        continue
      }
      const type = response.headers.get('content-type') ?? ''
      if (hops > 0) {
        // The page behind a redirect is recorded under the address that redirects; its own address is crawled separately.
        await response.body?.cancel().catch((): void => undefined)
        const result: PageResult = { statusCode: firstStatus, responseMs: firstMs, redirectTo, redirectHops: hops, bytes: null, data: null, issues: [] }
        result.issues = hops > 1 ? ['redirect-chain'] : []
        return result
      }
      if (!/html|xml/i.test(type) || response.status >= 300) {
        await response.body?.cancel().catch((): void => undefined)
        const result: PageResult = { statusCode: response.status, responseMs: ms, redirectTo: null, redirectHops: 0, bytes: null, data: null, issues: [] }
        result.issues = pageIssues({ path, statusCode: response.status, responseMs: ms, redirectTo: null, redirectHops: 0, inSitemap, facts: null, depth: null, inLinks: 0, outInternal: 0, outExternal: 0, brokenLinks: 0 })
        return result
      }
      const html = await readText(response, MAX_HTML_BYTES)
      const facts = parseHtmlFacts(html)
      const issues = pageIssues({ path, statusCode: response.status, responseMs: ms, redirectTo: null, redirectHops: 0, inSitemap, facts, depth: null, inLinks: 0, outInternal: 0, outExternal: 0, brokenLinks: 0 })
      return { statusCode: response.status, responseMs: ms, redirectTo: null, redirectHops: 0, bytes: new TextEncoder().encode(html).length, data: toStoredPage(facts, { lastModified: lastModifiedOf(response.headers.get('last-modified')), ...(await imageSizes(origin, facts.images, fetchImpl)) }), issues }
    }
  } catch {
    // A timeout or network failure is reported as a 5xx for the address.
    return { statusCode: 504, responseMs: FETCH_TIMEOUT_MS, redirectTo: null, redirectHops: 0, bytes: null, data: null, issues: ['status-5xx'] }
  }
}

export type StepOutcome = { done: number; total: number; finished: boolean; run: RunRow | null }

/** Fetches the next few waiting addresses; when none are left, finishes the run. Safe to call again and again. */
export async function crawlStep(db: Drizzle, runId: number, origin: string, opts: { fetchImpl?: FetchLike; limit?: number } = {}): Promise<StepOutcome> {
  const pending: PageRow[] = await pendingPages(db, runId, opts.limit ?? STEP_PAGES)
  // A few at a time keeps the number of sub-requests of one step small.
  for (let i = 0; i < pending.length; i += 4) {
    await Promise.all(
      pending.slice(i, i + 4).map(async (row) => {
        const result = await crawlOne(origin, row.path, row.inSitemap, opts.fetchImpl)
        await savePage(db, row.id, result)
      }),
    )
  }
  const { done, total } = await countDone(db, runId)
  if (done >= total) {
    const run = await finishRun(db, runId, origin)
    return { done, total, finished: true, run }
  }
  return { done, total, finished: false, run: null }
}

export async function startCrawl(db: Drizzle, source: 'manual' | 'schedule', targets: CrawlTarget[]): Promise<number> {
  return startRun(db, source, targets)
}
