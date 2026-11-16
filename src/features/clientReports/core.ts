/** Client reports (Task 22f): the pure rules. No database or engine imports. */

import { toCsv } from '@/features/shopReports/csv'

export type Preset = '7d' | '30d' | '90d' | 'month'
export const PRESETS: { value: Preset; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'month', label: 'This month so far' },
]
export type Cadence = 'none' | 'weekly' | 'monthly'
export const CADENCES: { value: Cadence; label: string }[] = [
  { value: 'none', label: 'Do not email' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
]

export const MAX_REPORTS = 50
export const MAX_RECIPIENTS = 10
export const MAX_NAME = 80

export const toPreset = (v: unknown): Preset => (v === '7d' || v === '90d' || v === 'month' ? v : '30d')
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
  content: { pages: number; posts: number }
}

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
  lines.push({ label: 'Published pages', value: String(d.content.pages) }, { label: 'Published posts', value: String(d.content.posts) })
  return lines
}

export function reportCsv(d: ReportData): string {
  return toCsv(['Measure', 'Value'], summaryLines(d).map((l) => [l.label, l.value]))
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function reportEmail(name: string, d: ReportData, link: string): { subject: string; html: string; text: string } {
  const lines = summaryLines(d)
  const html = `<h1>${esc(name)}</h1><table cellpadding="6" style="border-collapse:collapse">${lines.map((l) => `<tr><th align="left">${esc(l.label)}</th><td>${esc(l.value)}</td></tr>`).join('')}</table>${link ? `<p><a href="${esc(link)}">Open the full report</a></p>` : ''}`
  const text = `${name}\n\n${lines.map((l) => `${l.label}: ${l.value}`).join('\n')}${link ? `\n\nFull report: ${link}` : ''}`
  return { subject: `${name}: report for ${d.range.from} to ${d.range.to}`, html, text }
}
