import type { Engine } from '@/engine'
import { sendEmail } from '@/features/email'
import { loadShopCurrency } from '@/features/ecommerce/lib/shopCurrency'
import { loadKpis } from '@/features/shopReports/queries'
import { resolveRange } from '@/features/shopReports/range'
import { requestSiteOrigin, configuredSiteOrigin } from '@/utilities/siteOrigin'

import { buildPdf, type PdfLogo } from '@/features/apiBuilder/pdf'
import { storedLogo } from '@/features/email/designRender'

import { isReportDue, parseRecipients, reportEmail, reportPdfLines, wantsSection, type ReportData, type SectionKey } from './core'
import { loadSearch, loadTraffic } from './google'
import { MAX_LOGO_BYTES, parseLogo } from './logo'
import * as store from './store'

type Counter = { prepare: (sql: string) => { bind: (...a: unknown[]) => { all: <T>() => Promise<{ results: T[] }> } } }

/** The numbers for one report. Each part fails soft: a section whose table is missing (feature off) is left out. */
export type ReportSpec = Pick<store.ClientReport, 'preset' | 'sections' | 'rangeFrom' | 'rangeTo'>

export async function buildReport(engine: Engine, d1: Counter, spec: ReportSpec, now: Date): Promise<ReportData> {
  const range = resolveRange({ preset: spec.preset, from: spec.rangeFrom, to: spec.rangeTo }, now)
  const want = (key: SectionKey): boolean => wantsSection(spec.sections, key)
  let currency = 'AUD'
  let sales: ReportData['sales'] = null
  if (want('sales')) try {
    currency = await loadShopCurrency(engine as never)
    const k = await loadKpis(d1 as never, range)
    sales = { orders: k.orders, revenueCents: k.revenueCents, refundsCents: k.refundsCents, netCents: k.revenueCents - k.refundsCents, customers: k.customers, newCustomers: k.newCustomers, unitsSold: k.unitsSold }
  } catch {
    sales = null
  }
  let forms: ReportData['forms'] = null
  if (want('forms')) try {
    const r = (await d1.prepare('SELECT COUNT(*) AS n FROM eg_form_submissions WHERE date(COALESCE(submitted_at, created_at)) >= ?1 AND date(COALESCE(submitted_at, created_at)) <= ?2').bind(range.from, range.to).all<{ n: number }>()).results[0]
    forms = { submissions: Number(r?.n ?? 0) }
  } catch {
    forms = null
  }
  const count = async (collection: 'pages' | 'posts'): Promise<number> => {
    try {
      const res = await engine.find({ collection, overrideAccess: true, limit: 1, depth: 0, pagination: true, where: { _status: { equals: 'published' } } } as never)
      return Number((res as { totalDocs?: number }).totalDocs ?? 0)
    } catch {
      return 0
    }
  }
  let speed: ReportData['speed'] = null
  if (want('speed')) {
    try {
      const r = (await d1.prepare("SELECT COUNT(*) AS n, AVG(performance) AS avg FROM eg_pagespeed_results r WHERE r.strategy = 'mobile' AND r.performance IS NOT NULL AND r.id = (SELECT MAX(r2.id) FROM eg_pagespeed_results r2 WHERE r2.collection = r.collection AND r2.doc_id = r.doc_id AND r2.strategy = 'mobile')").bind().all<{ n: number; avg: number | null }>()).results[0]
      speed = { tested: Number(r?.n ?? 0), average: r?.avg === null || r?.avg === undefined ? null : Math.round(Number(r.avg)) }
    } catch {
      speed = null
    }
  }
  const dayRange = { from: range.from, to: range.to }
  const [traffic, search] = await Promise.all([want('traffic') ? loadTraffic(engine as never, dayRange) : null, want('search') ? loadSearch(engine as never, dayRange, now) : null])
  const content = want('content') ? { pages: await count('pages'), posts: await count('posts') } : null
  return { range: { from: range.from, to: range.to, days: range.days }, currency, sales, forms, content, traffic, search, speed }
}

/** The logo chosen under Email settings (the brand logo), as an address for the email and, when it is a JPEG or a plain PNG, as a PDF image. */
export async function loadLogo(engine: Engine): Promise<{ url: string; pdf: PdfLogo | null }> {
  try {
    const stored = storedLogo(await engine.findGlobal({ slug: 'email-brand', depth: 1, overrideAccess: true } as never))
    if (!stored?.url) return { url: '', pdf: null }
    let pdf: PdfLogo | null = null
    try {
      const res = await fetch(stored.url, { signal: AbortSignal.timeout(5000) })
      const declared = Number(res.headers.get('content-length') ?? 0)
      if (res.ok && declared <= MAX_LOGO_BYTES) pdf = parseLogo(new Uint8Array(await res.arrayBuffer()))
    } catch {
      pdf = null
    }
    return { url: stored.url, pdf }
  } catch {
    return { url: '', pdf: null }
  }
}

/** The report as a PDF file, with the brand logo when there is one that can be drawn. */
export async function reportPdf(engine: Engine, d1: Counter, report: store.ClientReport, spec: ReportSpec, now: Date): Promise<Uint8Array<ArrayBuffer>> {
  const [data, logo] = await Promise.all([buildReport(engine, d1, spec, now), loadLogo(engine)])
  return buildPdf(reportPdfLines(report.name, data), report.name, logo.pdf)
}

export const reportPdfLink = (origin: string, token: string): string => (origin ? `${origin.replace(/\/+$/, '')}/api/client-report?token=${token}&format=pdf` : '')

export const reportLink = (origin: string, token: string): string => (origin ? `${origin.replace(/\/+$/, '')}/client-report/${token}` : '')

/** Emails one report to its recipients. Returns a short result for the screen and the cron log. */
export async function sendReport(engine: Engine, d1: store.D1, report: store.ClientReport, now: Date, origin: string): Promise<{ ok: boolean; message: string }> {
  const to = parseRecipients(report.recipients)
  if (to.length === 0) return { ok: false, message: 'This report has no valid recipients.' }
  const data = await buildReport(engine, d1 as never, report, now)
  const logo = await loadLogo(engine)
  const mail = reportEmail(report.name, data, report.revoked ? '' : reportLink(origin, report.token), logo.url, report.revoked ? '' : reportPdfLink(origin, report.token))
  const result = await sendEmail({ to, subject: mail.subject, html: mail.html, text: mail.text, template: 'client-report' })
  if (!result.ok) return { ok: false, message: `The email was not sent: ${'error' in result && result.error ? result.error : 'unknown error'}` }
  await store.markSent(d1, report.id, now.toISOString())
  return { ok: true, message: `Sent to ${to.length} recipient(s).` }
}

/** The cron job: sends every report whose weekly or monthly time has come. */
export async function sendDueReports(engine: Engine, d1: store.D1, now: Date): Promise<string> {
  const origin = configuredSiteOrigin() || (await requestSiteOrigin().catch((): string => ''))
  let sent = 0
  for (const report of await store.listReports(d1)) {
    if (report.revoked || !isReportDue(report.cadence, report.lastSentAt, now)) continue
    if ((await sendReport(engine, d1, report, now, origin)).ok) sent += 1
    else await store.markSent(d1, report.id, now.toISOString()) // do not retry a broken one every hour
  }
  return `sent ${sent}`
}
