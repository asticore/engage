/**
 * Pure mapping and decision rules for the two-way Google Calendar sync (Task 15, 34j). No network and no database,
 * so every rule is unit tested. Times are stored in UTC here and sent to Google with an explicit time zone.
 */

export type SiteEvent = {
  id: number | string
  title: string
  summary?: string | null
  startDate: string
  endDate?: string | null
  venueName?: string | null
  address?: string | null
  updatedAt?: string | null
}

export type GoogleEvent = {
  id?: string
  status?: string
  summary?: string
  description?: string
  location?: string
  updated?: string
  start?: { dateTime?: string; date?: string; timeZone?: string }
  end?: { dateTime?: string; date?: string; timeZone?: string }
  extendedProperties?: { private?: Record<string, string> }
}

export type EventFields = { title: string; summary: string; startDate: string; endDate: string | null; venueName: string; address: string }

/** Tolerance for clock difference between this site and Google when deciding who changed last. */
export const SKEW_MS = 5000

const iso = (value: string): string => new Date(value).toISOString()
const DAY = 86_400_000

export function toGoogle(event: SiteEvent): GoogleEvent {
  const start = iso(event.startDate)
  const end = event.endDate ? iso(event.endDate) : new Date(new Date(start).getTime() + 3_600_000).toISOString()
  const location = [event.venueName, event.address].filter((p) => p && String(p).trim()).join(', ')
  return {
    summary: event.title,
    description: event.summary ?? '',
    ...(location ? { location } : {}),
    start: { dateTime: start, timeZone: 'UTC' },
    end: { dateTime: end, timeZone: 'UTC' },
    extendedProperties: { private: { engageId: String(event.id) } },
  }
}

export function fromGoogle(g: GoogleEvent): EventFields | null {
  const s = g.start?.dateTime ?? (g.start?.date ? `${g.start.date}T00:00:00Z` : null)
  if (!s || Number.isNaN(new Date(s).getTime())) return null
  const allDay = !g.start?.dateTime
  let e: string | null = g.end?.dateTime ?? (g.end?.date ? `${g.end.date}T00:00:00Z` : null)
  // An all-day event's end date is exclusive: show it as ending the evening before.
  if (allDay && e) e = new Date(new Date(e).getTime() - 1000).toISOString()
  if (e && Number.isNaN(new Date(e).getTime())) e = null
  const [venueName = '', ...rest] = (g.location ?? '').split(',')
  return {
    title: (g.summary ?? '').trim() || 'Untitled event',
    summary: g.description ?? '',
    startDate: new Date(s).toISOString(),
    endDate: e ? new Date(e).toISOString() : null,
    venueName: venueName.trim(),
    address: rest.join(',').trim(),
  }
}

/** Calendar for an event: the first rule line `keyword | calendarId` that matches the title or summary, else the default. */
export function pickCalendar(event: Pick<SiteEvent, 'title' | 'summary'>, rules: string, fallback: string): string {
  const hay = `${event.title} ${event.summary ?? ''}`.toLowerCase()
  for (const line of rules.split('\n')) {
    const [keyword, calendar] = line.split('|').map((p) => p.trim())
    if (keyword && calendar && hay.includes(keyword.toLowerCase())) return calendar
  }
  return fallback
}

export const ruleCalendars = (rules: string): string[] =>
  rules.split('\n').map((l) => l.split('|')[1]?.trim()).filter((c): c is string => Boolean(c))

export type Change = 'none' | 'push' | 'pull'

/**
 * Who changed since the last sync (`syncedAt`). Both changed means the later edit wins; a tie goes to the site.
 * `conflict` is true when both changed, so the caller can log it.
 */
export function decideChange(syncedAt: string, siteUpdated: string | null | undefined, googleUpdated: string | null | undefined): { change: Change; conflict: boolean } {
  const base = new Date(syncedAt).getTime() + SKEW_MS
  const site = siteUpdated ? new Date(siteUpdated).getTime() : 0
  const google = googleUpdated ? new Date(googleUpdated).getTime() : 0
  const siteChanged = site > base
  const googleChanged = google > base
  if (siteChanged && googleChanged) return { change: google > site ? 'pull' : 'push', conflict: true }
  if (siteChanged) return { change: 'push', conflict: false }
  if (googleChanged) return { change: 'pull', conflict: false }
  return { change: 'none', conflict: false }
}

export const DEFAULT_INTERVAL_MIN = 15
export const clampInterval = (n: unknown): number => Math.min(1440, Math.max(5, Math.round(Number(n)) || DEFAULT_INTERVAL_MIN))
export const lookbackIso = (now: Date): string => new Date(now.getTime() - 30 * DAY).toISOString()
