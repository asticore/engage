/** Input rules, statuses and email wording for quote, bid and item requests. Pure, shared by the public and admin routes. */
import { fillTemplate, textToHtml, type TemplateValues } from '@/features/email/renderTemplate'

export { hashToken, isManageToken as isQuoteToken, newManageToken as newQuoteToken } from '@/features/bookings/logic'

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export const REQUEST_KINDS = ['quote', 'bid', 'item'] as const
export type RequestKind = (typeof REQUEST_KINDS)[number]
export const isRequestKind = (v: unknown): v is RequestKind => typeof v === 'string' && (REQUEST_KINDS as readonly string[]).includes(v)

export const QUOTE_STATUSES = ['new', 'quoted', 'countered', 'accepted', 'declined', 'expired', 'closed'] as const
export type QuoteStatus = (typeof QUOTE_STATUSES)[number]
export const isQuoteStatus = (v: unknown): v is QuoteStatus => typeof v === 'string' && (QUOTE_STATUSES as readonly string[]).includes(v)

export const KIND_LABELS: Record<RequestKind, string> = { quote: 'Quote request', bid: 'Offer', item: 'Item request' }

/** QR-XXXXXX from the platform's random source. */
export function newQuoteNumber(): string {
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  return `QR-${Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').toUpperCase().slice(0, 6)}`
}

/** Dollars typed by a person ("12.50", "$1,200") to whole cents, or null. */
export function centsOf(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[$,\s]/g, ''))
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return null
  return Math.round(n * 100)
}

export type RequestInput = { kind: RequestKind; name: string; email: string; phone: string; quantity: number; details: string; deadline: string; productId: number | null; pageUrl: string; offerCents: number | null }

export function parseRequest(raw: unknown): { ok: true; value: RequestInput } | { ok: false; error: string } {
  const r = (raw ?? {}) as Record<string, unknown>
  const kind = isRequestKind(r.kind) ? r.kind : 'quote'
  const name = text(r.name, 120)
  if (!name) return { ok: false, error: 'Please give your name.' }
  const email = text(r.email, 200).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Please give a valid email address.' }
  const details = text(r.details, 4000)
  if (kind !== 'bid' && !details) return { ok: false, error: 'Tell us what you need.' }
  const qty = Math.floor(Number(r.quantity))
  const deadline = text(r.deadline, 10)
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return { ok: false, error: 'Write the deadline as a date.' }
  let offerCents: number | null = null
  if (kind === 'bid') {
    offerCents = centsOf(r.offer)
    if (!offerCents || offerCents <= 0) return { ok: false, error: 'Enter the amount you offer.' }
  }
  const product = Number(r.productId)
  return {
    ok: true,
    value: { kind, name, email, phone: text(r.phone, 60), quantity: Number.isFinite(qty) && qty >= 1 && qty <= 100000 ? qty : 1, details, deadline, productId: Number.isInteger(product) && product > 0 ? product : null, pageUrl: text(r.pageUrl, 500), offerCents },
  }
}

export type QuoteLine = { description: string; quantity: number; unitCents: number }
export type QuoteInput = { lines: QuoteLine[]; validUntil: string; terms: string; message: string }

export const lineCents = (l: QuoteLine): number => l.quantity * l.unitCents
export const totalCents = (lines: QuoteLine[]): number => lines.reduce((n, l) => n + lineCents(l), 0)

/** Lines, how many days the quote stays open, terms and a message. `now` makes the validity date. */
export function parseQuote(raw: unknown, now: Date): { ok: true; value: QuoteInput } | { ok: false; error: string } {
  const r = (raw ?? {}) as Record<string, unknown>
  const rows = Array.isArray(r.lines) ? r.lines : []
  const lines: QuoteLine[] = []
  for (const row of rows.slice(0, 30)) {
    const o = (row ?? {}) as Record<string, unknown>
    const description = text(o.description, 300)
    if (!description) continue
    const unit = centsOf(o.unit)
    const qty = Math.floor(Number(o.quantity))
    if (unit === null || !Number.isFinite(qty) || qty < 1 || qty > 100000) return { ok: false, error: `Check the price and quantity for "${description}".` }
    lines.push({ description, quantity: qty, unitCents: unit })
  }
  if (lines.length === 0) return { ok: false, error: 'Add at least one line to the quote.' }
  if (totalCents(lines) <= 0) return { ok: false, error: 'The quote total must be more than zero.' }
  const days = Math.floor(Number(r.validDays))
  const open = Number.isFinite(days) && days >= 1 && days <= 365 ? days : 14
  const validUntil = new Date(now.getTime() + open * 86_400_000).toISOString()
  return { ok: true, value: { lines, validUntil, terms: text(r.terms, 4000), message: text(r.message, 4000) } }
}

export function parseCounter(raw: unknown): { ok: true; value: { note: string; cents: number | null } } | { ok: false; error: string } {
  const r = (raw ?? {}) as Record<string, unknown>
  const note = text(r.note, 2000)
  const hasAmount = r.amount !== undefined && r.amount !== null && String(r.amount).trim() !== ''
  const cents = hasAmount ? centsOf(r.amount) : null
  if (hasAmount && (!cents || cents <= 0)) return { ok: false, error: 'Enter the amount you would pay.' }
  if (!note && cents === null) return { ok: false, error: 'Say what you would like changed, or give the amount you would pay.' }
  return { ok: true, value: { note, cents } }
}

/** A quote is open until its validity date; after that it reads as expired even before anything sweeps it. */
export const effectiveStatus = (status: QuoteStatus, validUntil: string | null, now: Date): QuoteStatus =>
  (status === 'quoted' || status === 'countered') && validUntil && Date.parse(validUntil) <= now.getTime() ? 'expired' : status

export type ActivityEntry = { at: string; by: 'customer' | 'staff' | 'system'; text: string }

/** Email wording. Tags like {{name}} are filled per customer; staff can also use them in their own message. */
export const QUOTE_EMAILS = {
  received: { subject: 'We got your {{kindLabel}} ({{number}})', body: 'Hi {{name}},\n\nThanks, we have your {{kindLabel}} ({{number}}). We will get back to you soon.\n\n{{siteName}}' },
  adminNew: { subject: 'New {{kindLabel}} {{number}} from {{name}}', body: '{{name}} ({{email}}) sent a {{kindLabel}}.\n\n{{details}}\n\nOpen it in Quotes and requests.' },
  quote: { subject: 'Your quote {{number}} from {{siteName}}', body: 'Hi {{name}},\n\n{{message}}\n\nTotal: {{total}}. Valid until {{validUntil}}.\n\nSee the quote, accept it or reply with a counter-offer:\n{{link}}\n\n{{siteName}}' },
  counter: { subject: 'Counter-offer on {{number}} from {{name}}', body: '{{name}} ({{email}}) replied to quote {{number}}.\n\n{{note}}' },
  accepted: { subject: 'Quote {{number}} accepted by {{name}}', body: '{{name}} accepted quote {{number}} for {{total}}. Order {{orderNumber}} is waiting for payment.' },
  declined: { subject: 'Quote {{number}} declined by {{name}}', body: '{{name}} declined quote {{number}}.' },
} as const
export type QuoteEmailKey = keyof typeof QUOTE_EMAILS

export function renderQuoteEmail(key: QuoteEmailKey, values: TemplateValues, bodyOverride?: string): { subject: string; text: string; html: string } {
  const t = QUOTE_EMAILS[key]
  const subject = fillTemplate(t.subject, values).replace(/[\r\n]+/g, ' ')
  const body = fillTemplate(t.body, { ...values, message: fillTemplate(bodyOverride || 'Thanks for asking. Here is your quote.', values) })
  return { subject, text: body, html: textToHtml(body) }
}
