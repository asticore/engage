/** Client reports (Task 22f): the pure rules. No database or engine imports. */

import { toCsv } from '@/features/shopReports/csv'

export type Preset = '7d' | '30d' | '90d' | 'month' | 'custom'
export const PRESETS: { value: Preset; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'month', label: 'This month so far' },
  { value: 'custom', label: 'Fixed dates' },
]

/** The parts a report can show. A report with none chosen shows all of them (reports made before sections existed). */
export type SectionKey = 'sales' | 'forms' | 'content' | 'traffic' | 'search' | 'speed'
export const SECTIONS: { value: SectionKey; label: string }[] = [
  { value: 'sales', label: 'Sales' },
  { value: 'forms', label: 'Form entries' },
  { value: 'content', label: 'Published pages and posts' },
  { value: 'traffic', label: 'Website traffic (Google Analytics)' },
  { value: 'search', label: 'Search (Google Search Console)' },
  { value: 'speed', label: 'Page speed' },
]
const SECTION_KEYS = SECTIONS.map((s) => s.value)

/** The chosen sections from typed or stored text (comma separated). Empty means all. */
export function parseSections(value: unknown): SectionKey[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  const out: SectionKey[] = []
  for (const item of raw) {
    const key = String(item).trim() as SectionKey
    if (SECTION_KEYS.includes(key) && !out.includes(key)) out.push(key)
  }
  return out
}
/** True when the report shows this section. */
export const wantsSection = (sections: SectionKey[], key: SectionKey): boolean => sections.length === 0 || sections.includes(key)
export type Cadence = 'none' | 'weekly' | 'monthly'
export const CADENCES: { value: Cadence; label: string }[] = [
  { value: 'none', label: 'Do not email' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
]

export const MAX_REPORTS = 50
export const MAX_RECIPIENTS = 10
export const MAX_NAME = 80

export const toPreset = (v: unknown): Preset => (v === '7d' || v === '90d' || v === 'month' || v === 'custom' ? v : '30d')

/** The report's own dates, or the dates a viewer picked on the link (both must be valid days, start not after end). */
export function withViewerRange<T extends { preset: Preset; rangeFrom: string; rangeTo: string }>(spec: T, from: unknown, to: unknown): T {
  const f = toDay(from)
  const t = toDay(to)
  return f && t && f <= t ? { ...spec, preset: 'custom', rangeFrom: f, rangeTo: t } : spec
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
/** A calendar day (YYYY-MM-DD) or an empty string. */
export const toDay = (v: unknown): string => {
  if (typeof v !== 'string' || !DAY_RE.test(v)) return ''
  const ms = Date.parse(`${v}T00:00:00Z`)
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === v ? v : ''
}
export const toCadence = (v: unknown): Cadence => (v === 'weekly' || v === 'monthly' ? v : 'none')

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Valid, unique addresses from typed text (commas, spaces, new lines), at most MAX_RECIPIENTS. */
export function parseRecipients(value: unknown): string[] {
  if (typeof value !== 'string') return []
  const out: string[] = []
  for (const part of value.split(/[\s,;]+/)) {
    const email = part.trim().toLowerCase()
    if (email.length <= 254 && EMAIL_RE.test(email) && !out.includes(email)) out.push(email)
  }
  return out.slice(0, MAX_RECIPIENTS)
}

/** True when a scheduled email is due. One that never went out is due at once. A few minutes of slack avoid skipping a period. */
export function isReportDue(cadence: Cadence, lastSentAt: string | null | undefined, now: Date): boolean {
  if (cadence === 'none') return false
  const last = lastSentAt ? Date.parse(lastSentAt) : NaN
  if (!Number.isFinite(last)) return true
  const gap = (cadence === 'weekly' ? 7 : 30) * 86_400_000
  return now.getTime() - last >= gap - 300_000
}

export type ReportData = {
  range: { from: string; to: string; days: number }
  currency: string
  sales: { orders: number; revenueCents: number; refundsCents: number; netCents: number; customers: number; newCustomers: number; unitsSold: number } | null
  forms: { submissions: number } | null
  content: { pages: number; posts: number } | null
  /** Google sections. Absent or null when not chosen for the report; `unavailable` carries the reason (not connected, no property chosen). */
  traffic?: GoogleSection<TrafficData> | null
  search?: GoogleSection<SearchData> | null
  speed?: { tested: number; average: number | null } | null
}

export type GoogleSection<T> = { state: 'ok'; data: T } | { state: 'unavailable'; message: string }
export type TrafficData = { users: number; sessions: number; topPages: { path: string; views: number }[]; channels: { channel: string; sessions: number }[] }
export type SearchData = { clicks: number; impressions: number; ctr: number; position: number; topQueries: { key: string; clicks: number; impressions: number }[]; topPages: { key: string; clicks: number; impressions: number }[] }

export type ReportTable = { title: string; head: string[]; rows: string[][] }

const money = (cents: number, currency: string): string => {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(cents / 100)
  } catch {
    return (cents / 100).toFixed(2)
  }
}

/** The lines shown on the report page and in the email, in one place. */
export function summaryLines(d: ReportData): { label: string; value: string }[] {
  const lines = [{ label: 'Period', value: `${d.range.from} to ${d.range.to} (${d.range.days} days)` }]
  if (d.sales) {
    lines.push(
      { label: 'Orders', value: String(d.sales.orders) },
      { label: 'Revenue', value: money(d.sales.revenueCents, d.currency) },
      { label: 'Refunds', value: money(d.sales.refundsCents, d.currency) },
      { label: 'Net revenue', value: money(d.sales.netCents, d.currency) },
      { label: 'Units sold', value: String(d.sales.unitsSold) },
      { label: 'Customers (new)', value: `${d.sales.customers} (${d.sales.newCustomers})` },
    )
  }
  if (d.forms) lines.push({ label: 'Form entries', value: String(d.forms.submissions) })
  if (d.content) lines.push({ label: 'Published pages', value: String(d.content.pages) }, { label: 'Published posts', value: String(d.content.posts) })
  if (d.traffic?.state === 'ok') lines.push({ label: 'Visitors', value: String(d.traffic.data.users) }, { label: 'Visits (sessions)', value: String(d.traffic.data.sessions) })
  if (d.traffic?.state === 'unavailable') lines.push({ label: 'Website traffic', value: d.traffic.message })
  if (d.search?.state === 'ok') {
    const g = d.search.data
    lines.push({ label: 'Search clicks', value: String(g.clicks) }, { label: 'Search impressions', value: String(g.impressions) }, { label: 'Click-through rate', value: `${(g.ctr * 100).toFixed(1)}%` }, { label: 'Average position', value: g.position ? g.position.toFixed(1) : '-' })
  }
  if (d.search?.state === 'unavailable') lines.push({ label: 'Search', value: d.search.message })
  if (d.speed) lines.push({ label: 'Pages with a speed test', value: String(d.speed.tested) }, { label: 'Average mobile speed score', value: d.speed.average === null ? '-' : String(d.speed.average) })
  return lines
}

/** The longer lists (top pages, channels, search queries), shown under the summary on the page, in the email and in the PDF. */
export function reportTables(d: ReportData): ReportTable[] {
  const out: ReportTable[] = []
  if (d.traffic?.state === 'ok') {
    const t = d.traffic.data
    if (t.topPages.length > 0) out.push({ title: 'Top pages by views', head: ['Page', 'Views'], rows: t.topPages.map((r) => [r.path, String(r.views)]) })
    if (t.channels.length > 0) out.push({ title: 'Where visitors came from', head: ['Channel', 'Visits'], rows: t.channels.map((r) => [r.channel, String(r.sessions)]) })
  }
  if (d.search?.state === 'ok') {
    const g = d.search.data
    if (g.topQueries.length > 0) out.push({ title: 'Top search queries', head: ['Query', 'Clicks', 'Impressions'], rows: g.topQueries.map((r) => [r.key, String(r.clicks), String(r.impressions)]) })
    if (g.topPages.length > 0) out.push({ title: 'Top pages in search', head: ['Page', 'Clicks', 'Impressions'], rows: g.topPages.map((r) => [r.key, String(r.clicks), String(r.impressions)]) })
  }
  return out
}

export function reportCsv(d: ReportData): string {
  const rows: string[][] = summaryLines(d).map((l) => [l.label, l.value])
  for (const t of reportTables(d)) {
    rows.push(['', ''])
    rows.push([t.title, t.head.slice(1).join(' / ')])
    for (const r of t.rows) rows.push([r[0] ?? '', r.slice(1).join(' / ')])
  }
  return toCsv(['Measure', 'Value'], rows)
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function reportEmail(name: string, d: ReportData, link: string, logoUrl = '', pdfLink = ''): { subject: string; html: string; text: string } {
  const lines = summaryLines(d)
  const tables = reportTables(d)
  const logo = /^https?:\/\//i.test(logoUrl) ? `<p><img src="${esc(logoUrl)}" alt="" style="max-height:48px;max-width:200px"></p>` : ''
  const tableHtml = tables.map((t) => `<h2>${esc(t.title)}</h2><table cellpadding="6" style="border-collapse:collapse"><tr>${t.head.map((h) => `<th align="left">${esc(h)}</th>`).join('')}</tr>${t.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`).join('')
  const html = `${logo}<h1>${esc(name)}</h1><table cellpadding="6" style="border-collapse:collapse">${lines.map((l) => `<tr><th align="left">${esc(l.label)}</th><td>${esc(l.value)}</td></tr>`).join('')}</table>${tableHtml}${link ? `<p><a href="${esc(link)}">Open the full report</a></p>` : ''}${pdfLink ? `<p><a href="${esc(pdfLink)}">Download as PDF</a></p>` : ''}`
  const tableText = tables.map((t) => `\n\n${t.title}\n${t.rows.map((r) => r.join(' | ')).join('\n')}`).join('')
  const text = `${name}\n\n${lines.map((l) => `${l.label}: ${l.value}`).join('\n')}${tableText}${link ? `\n\nFull report: ${link}` : ''}${pdfLink ? `\nPDF: ${pdfLink}` : ''}`
  return { subject: `${name}: report for ${d.range.from} to ${d.range.to}`, html, text }
}

/** The report as lines for the PDF writer: title, the summary, then each table. */
export function reportPdfLines(name: string, d: ReportData): { text: string; style: 'title' | 'h2' | 'body' | 'gap' }[] {
  const out: { text: string; style: 'title' | 'h2' | 'body' | 'gap' }[] = [{ text: name, style: 'title' }, { text: '', style: 'gap' }]
  for (const l of summaryLines(d)) out.push({ text: `${l.label}: ${l.value}`, style: 'body' })
  for (const t of reportTables(d)) {
    out.push({ text: t.title, style: 'h2' })
    out.push({ text: t.head.join('   |   '), style: 'body' })
    for (const r of t.rows) out.push({ text: r.join('   |   '), style: 'body' })
  }
  return out
}
