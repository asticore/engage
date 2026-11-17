/** Input rules for bookings: pure, shared by the admin and public routes. */
import { minutesOf, type Override, type Rule, type TypeRules } from './engine'
import { parseIsoDate } from '@/features/editScreens/timeZone'

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const int = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback
}

export const slugOf = (input: string): string => input.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)

export type TypeInput = { title: string; slug: string; description: string; resourceId: number | null; locationText: string; active: boolean; priceCents: number; refundHours: number } & TypeRules

export function parseTypeInput(raw: unknown): { ok: true; value: TypeInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Send the booking type details.' }
  const r = raw as Record<string, unknown>
  const title = text(r.title, 120)
  if (!title) return { ok: false, error: 'Give the booking type a name.' }
  const slug = slugOf(text(r.slug, 80) || title)
  if (!slug) return { ok: false, error: 'The name needs letters or digits to make an address from.' }
  const resource = Number(r.resourceId)
  return {
    ok: true,
    value: {
      title,
      slug,
      description: text(r.description, 2000),
      resourceId: Number.isInteger(resource) && resource > 0 ? resource : null,
      locationText: text(r.locationText, 300),
      active: r.active !== false,
      priceCents: int(r.priceCents, 0, 10_000_000, 0),
      refundHours: int(r.refundHours, 0, 24 * 365, 24),
      durationMinutes: int(r.durationMinutes, 5, 1440, 30),
      stepMinutes: int(r.stepMinutes, 5, 1440, 30),
      bufferBeforeMinutes: int(r.bufferBeforeMinutes, 0, 600, 0),
      bufferAfterMinutes: int(r.bufferAfterMinutes, 0, 600, 0),
      minNoticeMinutes: int(r.minNoticeMinutes, 0, 60 * 24 * 90, 60),
      maxAdvanceDays: int(r.maxAdvanceDays, 1, 365, 60),
      capacity: int(r.capacity, 1, 100, 1),
    },
  }
}

export function parseRules(raw: unknown): { ok: true; rules: Rule[] } | { ok: false; error: string } {
  const rows = Array.isArray(raw) ? raw : []
  const rules: Rule[] = []
  for (const row of rows.slice(0, 50)) {
    const r = (row ?? {}) as Record<string, unknown>
    const weekday = Number(r.weekday)
    const a = minutesOf(r.start)
    const b = minutesOf(r.end)
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return { ok: false, error: 'Each opening time needs a day of the week.' }
    if (a === null || b === null || b <= a) return { ok: false, error: 'Each opening time needs a start before its end, like 09:00 to 17:00.' }
    rules.push({ weekday, start: String(r.start).trim(), end: String(r.end).trim() })
  }
  return { ok: true, rules }
}

export function parseOverride(raw: unknown): { ok: true; value: Override & { note: string } } | { ok: false; error: string } {
  const r = (raw ?? {}) as Record<string, unknown>
  if (!parseIsoDate(r.date)) return { ok: false, error: 'Pick a real date.' }
  const kind = r.kind === 'open' ? 'open' : 'closed'
  const start = text(r.start, 5)
  const end = text(r.end, 5)
  const timed = Boolean(start || end)
  if (timed && (minutesOf(start) === null || minutesOf(end) === null || (minutesOf(end) as number) <= (minutesOf(start) as number))) return { ok: false, error: 'Give a start before the end, like 12:00 to 13:00, or leave both blank.' }
  if (kind === 'open' && !timed) return { ok: false, error: 'An extra open day needs a start and an end time.' }
  return { ok: true, value: { date: String(r.date).trim(), kind, start: timed ? start : null, end: timed ? end : null, note: text(r.note, 200) } }
}

export type CustomerInput = { name: string; email: string; phone: string; notes: string }

export function parseCustomer(raw: unknown): { ok: true; value: CustomerInput } | { ok: false; error: string } {
  const r = (raw ?? {}) as Record<string, unknown>
  const name = text(r.name, 120)
  const email = text(r.email, 200).toLowerCase()
  if (!name) return { ok: false, error: 'Enter your name.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Enter a valid email address.' }
  return { ok: true, value: { name, email, phone: text(r.phone, 40), notes: text(r.notes, 1000) } }
}

export const BOOKING_STATUSES = ['pending_payment', 'confirmed', 'completed', 'no_show', 'cancelled'] as const
export type BookingStatus = (typeof BOOKING_STATUSES)[number]
export const isBookingStatus = (v: unknown): v is BookingStatus => typeof v === 'string' && (BOOKING_STATUSES as readonly string[]).includes(v)

/** BK-XXXXXX from the platform's random source. */
export function newBookingNumber(): string {
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  return `BK-${Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').toUpperCase().slice(0, 6)}`
}

/** 32 hex characters: the private manage link secret. Only its hash is stored. */
export function newManageToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export const isManageToken = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{32}$/.test(v)

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

/** "mon 09:00-12:00" lines (also "mon-fri 09:00-17:00") to opening times. */
export function parseHoursText(textValue: string): { ok: true; rules: Rule[] } | { ok: false; error: string } {
  const rules: Rule[] = []
  for (const line of textValue.split(/\r?\n/)) {
    const clean = line.trim().toLowerCase()
    if (!clean) continue
    const m = /^([a-z]{3})(?:\s*-\s*([a-z]{3}))?\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(clean)
    const from = m ? (DAY_NAMES as readonly string[]).indexOf(m[1]) : -1
    const to = m ? (m[2] ? (DAY_NAMES as readonly string[]).indexOf(m[2]) : from) : -1
    if (!m || from < 0 || to < 0) return { ok: false, error: `Could not read "${line.trim()}". Write each line like "mon 09:00-12:00" or "mon-fri 09:00-17:00".` }
    // A range may wrap past Saturday, such as "fri-mon".
    for (let d = from, n = 0; n < 7; n++, d = (d + 1) % 7) {
      rules.push({ weekday: d, start: m[3], end: m[4] })
      if (d === to) break
    }
  }
  return parseRules(rules)
}

/** Opening times back to editable text, one line per window. */
export const hoursToText = (rules: Rule[]): string => rules.map((r) => `${DAY_NAMES[r.weekday]} ${r.start}-${r.end}`).join('\n')

export function parseResourceInput(raw: unknown): { ok: true; value: { title: string; timeZone: string; active: boolean } } | { ok: false; error: string } {
  const r = (raw ?? {}) as Record<string, unknown>
  const title = text(r.title, 120)
  if (!title) return { ok: false, error: 'Give the person or place a name.' }
  const timeZone = text(r.timeZone, 60) || 'Australia/Sydney'
  try {
    new Intl.DateTimeFormat('en', { timeZone })
  } catch {
    return { ok: false, error: `"${timeZone}" is not a time zone, for example Australia/Brisbane.` }
  }
  return { ok: true, value: { title, timeZone, active: r.active !== false } }
}

/** A paid booking is held for this long while the customer pays. Stripe's own minimum for a Checkout Session is 30 minutes. */
export const HOLD_MINUTES = 30

/** True while an unpaid booking still holds its time. Pure. */
export const holdActive = (createdAtMs: number, now: Date): boolean => now.getTime() - createdAtMs < HOLD_MINUTES * 60_000

/**
 * What a customer cancelling a paid booking gets back. The whole payment when the cancel is at least `refundHours`
 * before the start, nothing after that. A free or unpaid booking refunds nothing. Pure.
 */
export function refundCentsFor(args: { amountCents: number; refundedCents: number; refundHours: number; startMs: number; now: Date }): number {
  const left = Math.max(0, args.amountCents - args.refundedCents)
  if (left === 0) return 0
  return args.startMs - args.now.getTime() >= args.refundHours * 3_600_000 ? left : 0
}
