/** The date range for the dashboard sign-in cards. Pure, so it can be tested. Dates are UTC, YYYY-MM-DD. */
export const DEFAULT_RANGE_DAYS = 30
export const MAX_RANGE_DAYS = 365

export type SignInRange = { from: string; to: string; days: number; end: Date; custom: boolean }

const DAY = 86400000
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))
const dayMs = (v: string): number => Date.parse(`${v}T00:00:00Z`)
const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 10)

export function parseSignInRange(fromRaw: unknown, toRaw: unknown, now: Date): SignInRange {
  const today = iso(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const custom = isDate(fromRaw) || isDate(toRaw)
  let to = isDate(toRaw) ? toRaw : today
  if (to > today) to = today
  let from = isDate(fromRaw) ? fromRaw : iso(dayMs(to) - (DEFAULT_RANGE_DAYS - 1) * DAY)
  if (from > to) [from, to] = [to, from]
  if ((dayMs(to) - dayMs(from)) / DAY + 1 > MAX_RANGE_DAYS) from = iso(dayMs(to) - (MAX_RANGE_DAYS - 1) * DAY)
  const days = (dayMs(to) - dayMs(from)) / DAY + 1
  return { from, to, days, end: to === today ? now : new Date(`${to}T12:00:00Z`), custom }
}
