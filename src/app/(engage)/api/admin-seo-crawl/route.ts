import { NextResponse } from 'next/server'
import { drizzle } from 'drizzle-orm/d1'
import { getCloudflareContext } from '@opennextjs/cloudflare'

import { getAdminContext } from '@/admin/auth'
import { crawlStep, startCrawl } from '@/features/seo/crawl/runner'
import { buildCrawlTargets } from '@/features/seo/crawl/targets'
import { latestRuns, listPages, readSchedule, writeSchedule } from '@/features/seo/crawl/store'
import { ISSUE_CATALOG } from '@/features/seo/crawl/issues'
import { configuredSiteOrigin } from '@/utilities/siteOrigin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * The site audit crawl (Task 6, item 16o). Admin only.
 *   GET   -> { runs (newest first, at most 2), pages of the newest run, previous run's counts, schedule, issue catalogue }
 *   POST  { action: 'start' }                         starts a crawl of this site's own pages
 *   POST  { action: 'step', runId }                   fetches the next few waiting pages; the last step finishes the run
 *   POST  { action: 'schedule', schedule }            'off' | 'daily' | 'weekly'
 *   POST  { action: 'noindex', rows: [{collection,id}] } marks the pages noindex (as the signed-in user)
 *   POST  { action: 'redirect', rows: [{from}], to }  adds 301 redirects from the addresses to one place
 * The crawled addresses are never taken from the request: they come from the sitemap and the published pages.
 */

const noStore = { 'Cache-Control': 'no-store' }
const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: noStore })

export async function GET(): Promise<Response> {
  try {
    const context = await getAdminContext()
    if (!context.isAdmin) return json({ error: 'unauthorised' }, 401)
    const { env } = await getCloudflareContext({ async: true })
    const db = drizzle(env.D1) as never
    const runs = await latestRuns(db, 2)
    const current = runs[0] ?? null
    const pages = current ? await listPages(db, current.id) : []
    return json({ runs, pages, previous: runs[1] ?? null, schedule: await readSchedule(db), issues: ISSUE_CATALOG, origin: configuredSiteOrigin() })
  } catch (error) {
    console.error('admin-seo-crawl GET error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
}

type Row = { collection: string; id: number }

const parseRows = (value: unknown): Row[] =>
  (Array.isArray(value) ? value : [])
    .map((r): Row => ({ collection: String((r as Row)?.collection ?? ''), id: Number((r as Row)?.id) }))
    .filter((r) => ['pages', 'posts', 'products', 'events'].includes(r.collection) && Number.isInteger(r.id) && r.id > 0)
    .slice(0, 100)

export async function POST(request: Request): Promise<Response> {
  try {
    const context = await getAdminContext()
    if (!context.isAdmin) return json({ error: 'unauthorised' }, 401)
    const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
    const action = body?.action
    const { env } = await getCloudflareContext({ async: true })
    const db = drizzle(env.D1) as never
    const origin = configuredSiteOrigin()
    const engine = context.engine as unknown as {
      find: (a: Record<string, unknown>) => Promise<{ docs: unknown[] }>
      findByID: (a: Record<string, unknown>) => Promise<Record<string, unknown> | null>
      update: (a: Record<string, unknown>) => Promise<unknown>
      create: (a: Record<string, unknown>) => Promise<unknown>
    }

    if (action === 'start') {
      const { buildSitemapEntries } = await import('@/features/seo/sitemap')
      const entries = (await buildSitemapEntries().catch((): null => null)) ?? []
      const targets = await buildCrawlTargets(engine, origin, entries.map((e) => e.url))
      const runId = await startCrawl(db, 'manual', targets)
      return json({ runId, total: targets.length })
    }
    if (action === 'step') {
      const runId = Number(body?.runId)
      if (!Number.isInteger(runId) || runId <= 0) return json({ error: 'Send the run id.' }, 400)
      return json(await crawlStep(db, runId, origin))
    }
    if (action === 'schedule') {
      const schedule = body?.schedule
      if (schedule !== 'off' && schedule !== 'daily' && schedule !== 'weekly') return json({ error: 'Choose off, daily or weekly.' }, 400)
      await writeSchedule(db, schedule)
      return json({ schedule })
    }
    if (action === 'noindex') {
      const results: { collection: string; id: number; ok: boolean; error?: string }[] = []
      for (const row of parseRows(body?.rows)) {
        try {
          const current = await engine.findByID({ collection: row.collection, id: row.id, depth: 0, user: context.user, overrideAccess: false })
          if (!current || current.trashedAt) {
            results.push({ ...row, ok: false, error: 'Not found or not yours to change.' })
            continue
          }
          const seo = current.seo && typeof current.seo === 'object' ? { ...(current.seo as Record<string, unknown>) } : {}
          seo.noIndex = true
          await engine.update({ collection: row.collection, id: row.id, data: { seo }, user: context.user, overrideAccess: false })
          results.push({ ...row, ok: true })
        } catch (error) {
          results.push({ ...row, ok: false, error: error instanceof Error ? error.message : 'Could not save.' })
        }
      }
      return json({ results })
    }
    if (action === 'redirect') {
      const to = typeof body?.to === 'string' ? body.to.trim() : ''
      if (!to || !(to.startsWith('/') || /^https:\/\//i.test(to))) return json({ error: 'Send a place to redirect to: a path starting with / or an https address.' }, 400)
      const froms = (Array.isArray(body?.rows) ? body.rows : []).map((r) => String((r as { from?: unknown })?.from ?? '')).filter((f) => f.startsWith('/') && f !== '/' && f !== to).slice(0, 100)
      const results: { from: string; ok: boolean; error?: string }[] = []
      for (const from of froms) {
        try {
          await engine.create({ collection: 'redirects', data: { fromPath: from, toPath: to, redirectType: '301', enabled: true, note: 'Added from the site audit' }, user: context.user, overrideAccess: false })
          results.push({ from, ok: true })
        } catch (error) {
          results.push({ from, ok: false, error: error instanceof Error ? error.message : 'Could not add the redirect.' })
        }
      }
      return json({ results })
    }
    return json({ error: 'Unknown action.' }, 400)
  } catch (error) {
    console.error('admin-seo-crawl POST error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
}
