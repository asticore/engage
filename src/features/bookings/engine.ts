/**
 * Booking slot engine: weekly hours and one-off changes in, bookable start times out. Pure: no I/O, so the public page,
 * the slot endpoint and the create path all give one answer (Bookings plan appendix in docs/remaining-work.md, "Slot engine rules").
 *
 * Hours are wall-clock times in the resource's time zone. Each start is turned into a real instant with `zonedToUtc`,
 * so a day that crosses a daylight saving change keeps its wall-clock hours and the instants are right.
 */
import { fromDayNumber, parseIsoDate, toDayNumber, weekdayOfDay, zonedToUtc } from '@/features/editScreens/timeZone'

export type Rule = { weekday: number; start: string; end: string }
/** A one-off change for a date: closed all day (no times), closed for part of it, or open for a stretch. */
export type Override = { date: string; kind: 'open' | 'closed'; start?: string | null; end?: string | null }
export type Busy = { startMs: number; endMs: number; units: number }

export type TypeRules = {
  durationMinutes: number
  stepMinutes: number
  bufferBeforeMinutes: number
  bufferAfterMinutes: number
  minNoticeMinutes: number
  maxAdvanceDays: number
  capacity: number
}

export const DEFAULT_RULES: TypeRules = { durationMinutes: 30, stepMinutes: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 0, minNoticeMinutes: 60, maxAdvanceDays: 60, capacity: 1 }

export type Slot = { startMs: number; endMs: number; start: string; end: string; local: string }

const MIN = 60_000

/** "09:30" to minutes after midnight, or null. "24:00" is allowed as an end time. */
export function minutesOf(text: unknown): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(text ?? '').trim())
  if (!m) return null
  const h = Number(m[1])
  const mm = Number(m[2])
  if (mm > 59 || h > 24 || (h === 24 && mm !== 0)) return null
  return h * 60 + mm
}

export const timeText = (minutes: number): string => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

type Window = [number, number]

/** The open windows for one date, in minutes after local midnight, after the date's overrides. */
export function windowsFor(date: string, rules: Rule[], overrides: Override[]): Window[] {
  const ymd = parseIsoDate(date)
  if (!ymd) return []
  const weekday = weekdayOfDay(toDayNumber(ymd))
  let windows: Window[] = []
  for (const r of rules) {
    const a = minutesOf(r.start)
    const b = minutesOf(r.end)
    if (r.weekday === weekday && a !== null && b !== null && b > a) windows.push([a, b])
  }
  for (const o of overrides.filter((x) => x.date === date)) {
    const a = minutesOf(o.start)
    const b = minutesOf(o.end)
    const timed = a !== null && b !== null && b > a
    if (o.kind === 'closed') {
      windows = timed ? subtract(windows, [a as number, b as number]) : []
    } else if (timed) {
      windows.push([a as number, b as number])
    }
  }
  return merge(windows)
}

function merge(windows: Window[]): Window[] {
  const sorted = [...windows].sort((x, y) => x[0] - y[0])
  const out: Window[] = []
  for (const w of sorted) {
    const last = out[out.length - 1]
    if (last && w[0] <= last[1]) last[1] = Math.max(last[1], w[1])
    else out.push([w[0], w[1]])
  }
  return out
}

function subtract(windows: Window[], cut: Window): Window[] {
  const out: Window[] = []
  for (const [a, b] of windows) {
    if (cut[1] <= a || cut[0] >= b) out.push([a, b])
    else {
      if (cut[0] > a) out.push([a, cut[0]])
      if (cut[1] < b) out.push([cut[1], b])
    }
  }
  return out
}

/** Units already booked that overlap [startMs, endMs). */
const bookedUnits = (busy: Busy[], startMs: number, endMs: number): number => busy.reduce((n, b) => (b.startMs < endMs && b.endMs > startMs ? n + b.units : n), 0)

/** Every bookable start on one date, oldest first. `now` decides notice and advance limits. */
export function slotsForDate(date: string, timeZone: string, rules: Rule[], overrides: Override[], cfg: TypeRules, busy: Busy[], now: Date): Slot[] {
  const ymd = parseIsoDate(date)
  if (!ymd || cfg.durationMinutes <= 0) return []
  const step = Math.max(5, cfg.stepMinutes || cfg.durationMinutes)
  const earliest = now.getTime() + cfg.minNoticeMinutes * MIN
  const latest = now.getTime() + cfg.maxAdvanceDays * 86_400_000
  const slots: Slot[] = []
  for (const [a, b] of windowsFor(date, rules, overrides)) {
    for (let m = a; m + cfg.durationMinutes <= b; m += step) {
      const startMs = zonedToUtc({ ...ymd, hour: Math.floor(m / 60), minute: m % 60 }, timeZone).getTime()
      const endMs = startMs + cfg.durationMinutes * MIN
      if (startMs < earliest || startMs > latest) continue
      if (bookedUnits(busy, startMs - cfg.bufferBeforeMinutes * MIN, endMs + cfg.bufferAfterMinutes * MIN) >= cfg.capacity) continue
      slots.push({ startMs, endMs, start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString(), local: timeText(m) })
    }
  }
  return slots
}

/** The next `days` dates from `from` (YYYY-MM-DD) as YYYY-MM-DD. */
export function datesFrom(from: string, days: number): string[] {
  const ymd = parseIsoDate(from)
  if (!ymd) return []
  const base = toDayNumber(ymd)
  return Array.from({ length: Math.max(0, Math.min(days, 60)) }, (_, i) => {
    const d = fromDayNumber(base + i)
    return `${String(d.year).padStart(4, '0')}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
  })
}

/**
 * Insert-then-verify: after this booking's row is saved, look at every row that overlaps it (including itself) in id
 * order. It stays only when the units of the rows up to and including it fit in `capacity`. Two racers can both lose,
 * which is the safe side.
 */
export function winsSlot(myId: number, rows: { id: number; units: number }[], capacity: number): boolean {
  let used = 0
  for (const row of [...rows].sort((x, y) => x.id - y.id)) {
    used += row.units
    if (row.id === myId) return used <= capacity
  }
  return false
}
