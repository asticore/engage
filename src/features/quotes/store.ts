import { type ActivityEntry, type QuoteLine, type QuoteStatus, type RequestInput, type RequestKind } from './logic'

type Stmt = { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<{ meta?: { last_row_id?: number; changes?: number } }> } }
export type D1 = { prepare: (sql: string) => Stmt }
type Row = Record<string, unknown>

const all = async (d1: D1, sql: string, ...args: unknown[]): Promise<Row[]> => (await d1.prepare(sql).bind(...args).all<Row>()).results
const run = (d1: D1, sql: string, ...args: unknown[]) => d1.prepare(sql).bind(...args).run()

export type QuoteRequest = {
  id: number
  number: string
  kind: RequestKind
  status: QuoteStatus
  productId: number | null
  pageUrl: string
  name: string
  email: string
  phone: string
  quantity: number
  details: string
  deadline: string
  offerCents: number | null
  currency: string
  lines: QuoteLine[]
  totalCents: number | null
  validUntil: string | null
  terms: string
  orderId: number | null
  counterNote: string
  counterCents: number | null
  activity: ActivityEntry[]
  createdAt: string
}

const json = <T,>(v: unknown, fallback: T): T => {
  try {
    const parsed = JSON.parse(String(v ?? ''))
    return (Array.isArray(fallback) ? (Array.isArray(parsed) ? parsed : fallback) : parsed) as T
  } catch {
    return fallback
  }
}
const nullable = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))

const toRequest = (r: Row): QuoteRequest => ({
  id: Number(r.id),
  number: String(r.number ?? ''),
  kind: String(r.kind ?? 'quote') as RequestKind,
  status: String(r.status ?? 'new') as QuoteStatus,
  productId: nullable(r.product_id),
  pageUrl: String(r.page_url ?? ''),
  name: String(r.name ?? ''),
  email: String(r.email ?? ''),
  phone: String(r.phone ?? ''),
  quantity: Number(r.quantity ?? 1),
  details: String(r.details ?? ''),
  deadline: String(r.deadline ?? ''),
  offerCents: nullable(r.offer_cents),
  currency: String(r.currency ?? 'AUD'),
  lines: json<QuoteLine[]>(r.quote_lines, []),
  totalCents: nullable(r.quote_total_cents),
  validUntil: r.valid_until ? String(r.valid_until) : null,
  terms: String(r.terms ?? ''),
  orderId: nullable(r.order_id),
  counterNote: String(r.counter_note ?? ''),
  counterCents: nullable(r.counter_cents),
  activity: json<ActivityEntry[]>(r.activity, []),
  createdAt: String(r.created_at ?? ''),
})

const entry = (by: ActivityEntry['by'], text: string, at: string): ActivityEntry => ({ at, by, text })

export async function createRequest(d1: D1, number: string, input: RequestInput, currency: string, nowIso: string): Promise<QuoteRequest | null> {
  const start = [entry('customer', input.kind === 'bid' ? 'Offer made.' : 'Request sent.', nowIso)]
  const inserted = await run(
    d1,
    "INSERT INTO eg_quote_requests (number, kind, status, product_id, page_url, name, email, phone, quantity, details, deadline, offer_cents, currency, activity, updated_at, created_at) VALUES (?1,?2,'new',?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?14)",
    number, input.kind, input.productId, input.pageUrl, input.name, input.email, input.phone, input.quantity, input.details, input.deadline, input.offerCents, currency, JSON.stringify(start), nowIso,
  )
  return (await getRequest(d1, Number(inserted.meta?.last_row_id ?? 0))) ?? null
}

export async function getRequest(d1: D1, id: number): Promise<QuoteRequest | null> {
  const rows = await all(d1, 'SELECT * FROM eg_quote_requests WHERE id = ?1', id)
  return rows[0] ? toRequest(rows[0]) : null
}
export async function getByTokenHash(d1: D1, hash: string): Promise<QuoteRequest | null> {
  const rows = await all(d1, 'SELECT * FROM eg_quote_requests WHERE token_hash = ?1', hash)
  return rows[0] ? toRequest(rows[0]) : null
}
export async function listRequests(d1: D1, filter: { status?: string }, limit = 200): Promise<QuoteRequest[]> {
  const sql = `SELECT * FROM eg_quote_requests${filter.status ? ' WHERE status = ?1' : ''} ORDER BY id DESC LIMIT ${Math.max(1, Math.min(limit, 500))}`
  return (await all(d1, sql, ...(filter.status ? [filter.status] : []))).map(toRequest)
}

/** A customer's requests by the email on them, newest first. Callers pass only a confirmed account email. */
export async function listByEmail(d1: D1, email: string, limit = 50): Promise<QuoteRequest[]> {
  return (await all(d1, `SELECT * FROM eg_quote_requests WHERE lower(email) = ?1 ORDER BY id DESC LIMIT ${Math.max(1, Math.min(limit, 200))}`, email.trim().toLowerCase())).map(toRequest)
}
/** Replaces the private link of a request that has a quote. The link in an earlier email stops working. */
export async function setTokenHash(d1: D1, id: number, tokenHash: string, nowIso: string): Promise<boolean> {
  const res = await run(d1, 'UPDATE eg_quote_requests SET token_hash = ?1, updated_at = ?2 WHERE id = ?3 AND quote_total_cents IS NOT NULL', tokenHash, nowIso, id)
  return (res.meta?.changes ?? 0) > 0
}

/** Adds an activity line. Read-modify-write: the log is a note for staff, not a ledger. */
export async function addActivity(d1: D1, id: number, by: ActivityEntry['by'], text: string, nowIso: string): Promise<void> {
  const current = await getRequest(d1, id)
  if (!current) return
  await run(d1, 'UPDATE eg_quote_requests SET activity = ?1, updated_at = ?2 WHERE id = ?3', JSON.stringify([...current.activity, entry(by, text, nowIso)].slice(-200)), nowIso, id)
}

/** Staff priced the request: saves the lines and opens the quote. A customer who has accepted cannot be re-quoted. */
export async function saveQuote(d1: D1, id: number, q: { lines: QuoteLine[]; totalCents: number; validUntil: string; terms: string; tokenHash: string }, nowIso: string): Promise<boolean> {
  const res = await run(
    d1,
    "UPDATE eg_quote_requests SET quote_lines = ?1, quote_total_cents = ?2, valid_until = ?3, terms = ?4, token_hash = ?7, status = 'quoted', counter_note = '', counter_cents = NULL, updated_at = ?5 WHERE id = ?6 AND status IN ('new','quoted','countered','expired')",
    JSON.stringify(q.lines), q.totalCents, q.validUntil, q.terms, nowIso, id, q.tokenHash,
  )
  return (res.meta?.changes ?? 0) > 0
}

/** Moves between statuses only from the listed ones, so two clicks cannot both win. Returns true when this call made the change. */
export async function moveStatus(d1: D1, id: number, to: QuoteStatus, from: QuoteStatus[], nowIso: string): Promise<boolean> {
  const marks = from.map((_, i) => `?${i + 4}`).join(',')
  const res = await run(d1, `UPDATE eg_quote_requests SET status = ?1, updated_at = ?2 WHERE id = ?3 AND status IN (${marks})`, to, nowIso, id, ...from)
  return (res.meta?.changes ?? 0) > 0
}
export async function setCounter(d1: D1, id: number, note: string, cents: number | null, nowIso: string): Promise<boolean> {
  const res = await run(d1, "UPDATE eg_quote_requests SET counter_note = ?1, counter_cents = ?2, status = 'countered', updated_at = ?3 WHERE id = ?4 AND status IN ('quoted','countered')", note, cents, nowIso, id)
  return (res.meta?.changes ?? 0) > 0
}
export async function setOrder(d1: D1, id: number, orderId: number, nowIso: string): Promise<void> {
  await run(d1, 'UPDATE eg_quote_requests SET order_id = ?1, updated_at = ?2 WHERE id = ?3', orderId, nowIso, id)
}
/** Quotes past their validity date are closed. Run from the admin list and the customer page; cheap and safe to repeat. */
export async function expireOverdue(d1: D1, nowIso: string): Promise<number> {
  const res = await run(d1, "UPDATE eg_quote_requests SET status = 'expired', updated_at = ?1 WHERE status IN ('quoted','countered') AND valid_until IS NOT NULL AND valid_until <= ?1", nowIso)
  return res.meta?.changes ?? 0
}
export async function deleteRequest(d1: D1, id: number): Promise<void> {
  await run(d1, 'DELETE FROM eg_quote_requests WHERE id = ?1', id)
}

/** Open quotes whose validity ends within `withinMs` of now, soonest first. */
export async function listExpiring(d1: D1, nowIso: string, untilIso: string, limit = 100): Promise<QuoteRequest[]> {
  const rows = await all(d1, "SELECT * FROM eg_quote_requests WHERE status IN ('quoted','countered') AND valid_until IS NOT NULL AND valid_until > ?1 AND valid_until <= ?2 ORDER BY valid_until ASC LIMIT ?3", nowIso, untilIso, Math.max(1, Math.min(limit, 500)))
  return rows.map(toRequest)
}

/** The Offers settings of one product (minimum in cents, end time and title), or null when the product is gone. */
export async function productBidTerms(d1: D1, productId: number): Promise<{ title: string; minimumCents: number; endsAt: string | null } | null> {
  const rows = await all(d1, 'SELECT title, bid_minimum, bid_ends_at FROM eg_products WHERE id = ?1', productId)
  if (!rows[0]) return null
  return { title: String(rows[0].title ?? ''), minimumCents: Math.round(Number(rows[0].bid_minimum ?? 0) * 100), endsAt: rows[0].bid_ends_at ? String(rows[0].bid_ends_at) : null }
}
/** Products that have unanswered offers. */
export async function productsWithOpenBids(d1: D1): Promise<number[]> {
  return (await all(d1, "SELECT DISTINCT product_id FROM eg_quote_requests WHERE kind = 'bid' AND status = 'new' AND product_id IS NOT NULL LIMIT 200")).map((r) => Number(r.product_id))
}
export async function openBidsFor(d1: D1, productId: number): Promise<QuoteRequest[]> {
  return (await all(d1, "SELECT * FROM eg_quote_requests WHERE kind = 'bid' AND status = 'new' AND product_id = ?1 ORDER BY id LIMIT 500", productId)).map(toRequest)
}
