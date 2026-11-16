import type { Engine } from '@/engine'
import { sendEmail } from '@/features/email'
import { loadShopCurrency } from '@/features/ecommerce/lib/shopCurrency'
import { loadKpis } from '@/features/shopReports/queries'
import { resolveRange } from '@/features/shopReports/range'
import { requestSiteOrigin, configuredSiteOrigin } from '@/utilities/siteOrigin'

import { isReportDue, parseRecipients, reportEmail, type Preset, type ReportData } from './core'
import * as store from './store'

type Counter = { prepare: (sql: string) => { bind: (...a: unknown[]) => { all: <T>() => Promise<{ results: T[] }> } } }

/** The numbers for one report. Each part fails soft: a section whose table is missing (feature off) is left out. */
export async function buildReport(engine: Engine, d1: Counter, preset: Preset, now: Date): Promise<ReportData> {
  const range = resolveRange({ preset }, now)
  let currency = 'AUD'
  let sales: ReportData['sales'] = null
  try {
    currency = await loadShopCurrency(engine as never)
    const k = await loadKpis(d1 as never, range)
    sales = { orders: k.orders, revenueCents: k.revenueCents, refundsCents: k.refundsCents, netCents: k.revenueCents - k.refundsCents, customers: k.customers, newCustomers: k.newCustomers, unitsSold: k.unitsSold }
  } catch {
    sales = null
  }
  let forms: ReportData['forms'] = null
  try {
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
  return { range: { from: range.from, to: range.to, days: range.days }, currency, sales, forms, content: { pages: await count('pages'), posts: await count('posts') } }
}

export const reportLink = (origin: string, token: string): string => (origin ? `${origin.replace(/\/+$/, '')}/client-report/${token}` : '')

/** Emails one report to its recipients. Returns a short result for the screen and the cron log. */
export async function sendReport(engine: Engine, d1: store.D1, report: store.ClientReport, now: Date, origin: string): Promise<{ ok: boolean; message: string }> {
  const to = parseRecipients(report.recipients)
  if (to.length === 0) return { ok: false, message: 'This report has no valid recipients.' }
  const data = await buildReport(engine, d1 as never, report.preset, now)
  const mail = reportEmail(report.name, data, report.revoked ? '' : reportLink(origin, report.token))
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
