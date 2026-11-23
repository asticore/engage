/** Pure helpers for the public Calendar element: event shape, categories, tags, grids, filters, links. */

export type CalEvent = {
  id: string
  slug: string
  title: string
  /** ISO instants. */
  start: string
  end: string
  summary: string
  venue: string
  online: boolean
  image: string
  paid: boolean
  category: string
  color: string
  tags: string[]
}

export type CategoryRule = { keyword: string; category: string; color: string }

export const CAL_VIEWS = ['month', 'week', 'day', 'agenda', 'list'] as const
export type CalView = (typeof CAL_VIEWS)[number]

const COLOR = /^#[0-9a-fA-F]{3,8}$/

/** One rule per line: `keyword | Category | #colour`. The first rule whose keyword is in the title or summary wins. */
export function parseRules(text: unknown): CategoryRule[] {
  if (typeof text !== 'string') return []
  const out: CategoryRule[] = []
  for (const line of text.split('\n')) {
    const [keyword = '', category = '', color = ''] = line.split('|').map((x) => x.trim())
    if (!keyword || !category) continue
    out.push({ keyword: keyword.toLowerCase(), category, color: COLOR.test(color) ? color : '' })
  }
  return out
}

/** Hashtags in a text, lower case, without the #. */
export function extractTags(text: string): string[] {
  const set = new Set<string>()
  for (const m of text.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]{2,30})/gu)) set.add(m[1]!.toLowerCase())
  return [...set]
}

export function categorise(title: string, summary: string, rules: CategoryRule[], fallback: { category: string; color: string }): { category: string; color: string } {
  const hay = `${title} ${summary}`.toLowerCase()
  const hit = rules.find((r) => hay.includes(r.keyword))
  return hit ? { category: hit.category, color: hit.color || fallback.color } : fallback
}

export function filterEvents(events: CalEvent[], f: { category?: string; tag?: string; q?: string }): CalEvent[] {
  const q = (f.q ?? '').trim().toLowerCase()
  return events.filter((e) => {
    if (f.category && e.category !== f.category) return false
    if (f.tag && !e.tags.includes(f.tag)) return false
    if (q && !`${e.title} ${e.summary} ${e.venue}`.toLowerCase().includes(q)) return false
    return true
  })
}

/** `YYYY-MM-DD` of an instant as seen in a time zone ('' = the viewer's own). Falls back to UTC for a bad zone. */
export function dayKeyIn(iso: string, timeZone?: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

const pad = (n: number): string => String(n).padStart(2, '0')
/** Calendar date arithmetic on `YYYY-MM-DD` keys (no time zones involved). */
export const keyOf = (d: Date): string => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
export const dateOf = (key: string): Date => new Date(`${key}T00:00:00Z`)
export const addDays = (key: string, n: number): string => keyOf(new Date(dateOf(key).getTime() + n * 86_400_000))

/** First day of the week 0 = Sunday ... 6. Returns the key of the first cell of the week holding `key`. */
export function weekStart(key: string, firstDay: number): string {
  const dow = dateOf(key).getUTCDay()
  return addDays(key, -((dow - firstDay + 7) % 7))
}

/** Rows of 7 day keys covering a month (6 rows max). */
export function monthGrid(year: number, month: number, firstDay: number): string[][] {
  const first = keyOf(new Date(Date.UTC(year, month, 1)))
  let cur = weekStart(first, firstDay)
  const rows: string[][] = []
  for (let r = 0; r < 6; r++) {
    const row: string[] = []
    for (let c = 0; c < 7; c++) {
      row.push(cur)
      cur = addDays(cur, 1)
    }
    rows.push(row)
    if (dateOf(cur).getUTCMonth() !== month && r >= 3) break
  }
  return rows
}

/** Events that touch a day (multi-day events appear on each day), sorted by start. */
export function eventsOnDay(events: CalEvent[], day: string, timeZone?: string): CalEvent[] {
  return events
    .filter((e) => {
      const s = dayKeyIn(e.start, timeZone)
      const en = dayKeyIn(e.end, timeZone) || s
      return s <= day && day <= (en >= s ? en : s)
    })
    .sort((a, b) => a.start.localeCompare(b.start))
}

const gcalStamp = (iso: string): string => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '')

/** "Add to Google Calendar" link. */
export function googleCalendarUrl(e: CalEvent, origin: string): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${gcalStamp(new Date(e.start).toISOString())}/${gcalStamp(new Date(e.end || e.start).toISOString())}`,
    details: `${e.summary}${e.summary ? '\n\n' : ''}${origin}/events/${e.slug}`.trim(),
  })
  if (e.venue) p.set('location', e.venue)
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

export function formatTime(iso: string, opts: { hour12: boolean; timeZone?: string; locale?: string }): string {
  try {
    return new Intl.DateTimeFormat(opts.locale || undefined, { hour: 'numeric', minute: '2-digit', hour12: opts.hour12, timeZone: opts.timeZone || undefined }).format(new Date(iso))
  } catch {
    return ''
  }
}

export const clampFirstDay = (v: unknown): number => {
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 && n <= 6 ? n : 1
}
