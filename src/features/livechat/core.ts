/**
 * Live chat (Task 30b), pure parts: settings, opening hours, who is online, message checks, canned replies and the transcript.
 * Nothing here touches a database or the network.
 */

export type ChatStatus = 'open' | 'closed' | 'offline'
export const CHAT_STATUSES: readonly ChatStatus[] = ['open', 'closed', 'offline']
export type Sender = 'visitor' | 'staff' | 'system'

export const MAX_MESSAGE = 1000
export const MAX_NAME = 60
export const MAX_CANNED = 50
/** A staff member counts as online for this long after their inbox last checked in. */
export const STAFF_ONLINE_SECONDS = 90

export type Schedule = { days: number[]; from: string; to: string; timezone: string }

export type LiveChatSettings = {
  /** Only show "Talk to a person" while inside these hours (and a staff member has the inbox open). Off means any time a staff member is online. */
  useSchedule: boolean
  schedule: Schedule
  welcome: string
  /** Shown to a visitor when nobody is available. */
  offlineMessage: string
  /** Where new chats and offline messages are emailed. Empty uses the shop admin address. */
  notifyEmail: string
  notifyPush: boolean
  /** Close a chat after this many idle hours. 0 never. */
  autoCloseHours: number
  /** Delete closed chats older than this many days. 0 keeps them until erased. */
  retentionDays: number
  ratePerHour: number
}

export const DEFAULT_LIVECHAT_SETTINGS: LiveChatSettings = {
  useSchedule: false,
  schedule: { days: [1, 2, 3, 4, 5], from: '09:00', to: '17:00', timezone: 'UTC' },
  welcome: 'You are chatting with our team. Ask your question and we will reply here.',
  offlineMessage: "We're offline right now. Leave your name, email and message and we will reply by email.",
  notifyEmail: '',
  notifyPush: true,
  autoCloseHours: 24,
  retentionDays: 180,
  ratePerHour: 15,
}

export const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback
}

const time = (v: unknown, fallback: string): string => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback)
const text = (v: unknown, max: number, fallback: string): string => (typeof v === 'string' ? v.trim().slice(0, max) : fallback)

export function validTimezone(tz: unknown): string {
  if (typeof tz !== 'string' || !tz) return 'UTC'
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return tz
  } catch {
    return 'UTC'
  }
}

export function cleanSettings(raw: Record<string, unknown> | null | undefined): LiveChatSettings {
  const d = DEFAULT_LIVECHAT_SETTINGS
  const r = raw ?? {}
  const s = (r.schedule ?? {}) as Record<string, unknown>
  const days = Array.isArray(s.days) ? [...new Set(s.days.map((n) => Math.floor(Number(n))).filter((n) => n >= 0 && n <= 6))].sort() : d.schedule.days
  const email = typeof r.notifyEmail === 'string' ? r.notifyEmail.trim() : ''
  return {
    useSchedule: r.useSchedule === true,
    schedule: { days, from: time(s.from, d.schedule.from), to: time(s.to, d.schedule.to), timezone: validTimezone(s.timezone) },
    welcome: text(r.welcome, 300, d.welcome),
    offlineMessage: text(r.offlineMessage, 400, d.offlineMessage) || d.offlineMessage,
    notifyEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.slice(0, 200) : '',
    notifyPush: r.notifyPush !== false,
    autoCloseHours: clampInt(r.autoCloseHours, 0, 720, d.autoCloseHours),
    retentionDays: clampInt(r.retentionDays, 0, 3650, d.retentionDays),
    ratePerHour: clampInt(r.ratePerHour, 1, 200, d.ratePerHour),
  }
}

/** Minutes since midnight and weekday (0 Sunday) in a time zone. */
export function localParts(now: Date, timezone: string): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: validTimezone(timezone), weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? ''
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  return { day, minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

const toMinutes = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

export function inSchedule(now: Date, s: Schedule): boolean {
  const { day, minutes } = localParts(now, s.timezone)
  if (!s.days.includes(day)) return false
  const from = toMinutes(s.from)
  const to = toMinutes(s.to)
  return from <= to ? minutes >= from && minutes < to : minutes >= from || minutes < to
}

export type Availability = { online: boolean; reason: 'online' | 'no-staff' | 'outside-hours' }

export function availability(now: Date, settings: LiveChatSettings, staffOnline: number): Availability {
  if (settings.useSchedule && !inSchedule(now, settings.schedule)) return { online: false, reason: 'outside-hours' }
  return staffOnline > 0 ? { online: true, reason: 'online' } : { online: false, reason: 'no-staff' }
}

export const staffCutoff = (now: Date): string => new Date(now.getTime() - STAFF_ONLINE_SECONDS * 1000).toISOString()

/* ------------------------------------------------------------- messages */

export const cleanMessage = (raw: unknown): string => (typeof raw === 'string' ? raw.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim().slice(0, MAX_MESSAGE) : '')
export const cleanName = (raw: unknown): string => (typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) : '')
export const cleanEmail = (raw: unknown): string => {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase().slice(0, 200) : ''
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : ''
}

export type Canned = { title: string; body: string }
export function cleanCanned(raw: unknown): Canned | null {
  const r = (raw ?? {}) as Record<string, unknown>
  const title = typeof r.title === 'string' ? r.title.trim().slice(0, 60) : ''
  const body = typeof r.body === 'string' ? r.body.trim().slice(0, MAX_MESSAGE) : ''
  return title && body ? { title, body } : null
}

/** Fills {name} in a canned reply with the visitor's first name. */
export const fillCanned = (body: string, visitorName: string): string => body.replace(/\{name\}/gi, visitorName.trim().split(/\s+/)[0] || 'there')

export type TranscriptLine = { sender: Sender; name: string; content: string; at: string; note?: boolean }

/** Plain text transcript. Internal notes are never included. */
export function buildTranscript(siteName: string, lines: TranscriptLine[]): string {
  const body = lines
    .filter((l) => !l.note && l.sender !== 'system')
    .map((l) => `[${l.at.slice(0, 16).replace('T', ' ')}] ${l.sender === 'staff' ? l.name || 'Support' : l.name || 'You'}: ${l.content}`)
    .join('\n')
  return `Chat transcript${siteName ? ` from ${siteName}` : ''}\n\n${body}\n`
}

export const isIdle = (lastActivityIso: string, hours: number, now: Date): boolean => hours > 0 && now.getTime() - new Date(lastActivityIso).getTime() > hours * 3_600_000

export const retentionCutoff = (now: Date, days: number): string | null => (days > 0 ? new Date(now.getTime() - days * 86_400_000).toISOString() : null)
