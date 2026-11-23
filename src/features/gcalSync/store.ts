import { resolveD1Binding } from '@/cms/db/connect'

import { clampInterval, DEFAULT_INTERVAL_MIN } from './map'

/**
 * Tables behind the Google Calendar sync, created on first use (no migration; a site that never turns the sync on
 * carries nothing extra): the settings row, one link row per synced event, and a short log.
 */

type Statement = { first<T>(): Promise<T | null>; all<T>(): Promise<{ results?: T[] }>; run(): Promise<unknown> }
export type GcalD1 = { prepare(sql: string): { bind(...values: unknown[]): Statement } }

const CREATE = [
  'CREATE TABLE IF NOT EXISTS eg_gcal_config (id INTEGER PRIMARY KEY NOT NULL, enabled INTEGER NOT NULL DEFAULT 0, calendar_id TEXT NOT NULL DEFAULT \'primary\', rules TEXT NOT NULL DEFAULT \'\', interval_min INTEGER NOT NULL DEFAULT 15, tokens TEXT NOT NULL DEFAULT \'{}\', last_run_at TEXT)',
  'CREATE TABLE IF NOT EXISTS eg_gcal_links (event_id TEXT NOT NULL, calendar_id TEXT NOT NULL, google_id TEXT NOT NULL, synced_at TEXT NOT NULL, PRIMARY KEY (event_id), UNIQUE (calendar_id, google_id))',
  'CREATE TABLE IF NOT EXISTS eg_gcal_log (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, at TEXT NOT NULL, level TEXT NOT NULL, message TEXT NOT NULL)',
]

let ensured: Promise<void> | null = null

export async function gcalDb(): Promise<GcalD1> {
  const d1 = (await resolveD1Binding()) as unknown as GcalD1
  if (!ensured) {
    ensured = (async () => {
      for (const statement of CREATE) await d1.prepare(statement).bind().run()
    })().catch((error: unknown): never => {
      ensured = null
      throw error
    })
  }
  await ensured
  return d1
}

export type GcalConfig = { enabled: boolean; calendarId: string; rules: string; intervalMin: number; tokens: Record<string, string>; lastRunAt: string | null }
type RawConfig = { enabled: number; calendar_id: string; rules: string; interval_min: number; tokens: string; last_run_at: string | null }

export async function readConfig(db: GcalD1): Promise<GcalConfig> {
  const r = await db.prepare('SELECT enabled, calendar_id, rules, interval_min, tokens, last_run_at FROM eg_gcal_config WHERE id = 1').bind().first<RawConfig>()
  let tokens: Record<string, string> = {}
  try {
    tokens = r ? (JSON.parse(r.tokens) as Record<string, string>) : {}
  } catch {
    tokens = {}
  }
  return { enabled: r ? Number(r.enabled) === 1 : false, calendarId: r?.calendar_id || 'primary', rules: r?.rules ?? '', intervalMin: r?.interval_min ?? DEFAULT_INTERVAL_MIN, tokens, lastRunAt: r?.last_run_at ?? null }
}

export async function writeConfig(db: GcalD1, next: Partial<GcalConfig>): Promise<GcalConfig> {
  const cur = await readConfig(db)
  const m = { ...cur, ...next }
  await db
    .prepare('INSERT INTO eg_gcal_config (id, enabled, calendar_id, rules, interval_min, tokens, last_run_at) VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(id) DO UPDATE SET enabled = ?1, calendar_id = ?2, rules = ?3, interval_min = ?4, tokens = ?5, last_run_at = ?6')
    .bind(m.enabled ? 1 : 0, m.calendarId.trim() || 'primary', m.rules, clampInterval(m.intervalMin), JSON.stringify(m.tokens), m.lastRunAt)
    .run()
  return readConfig(db)
}

export type Link = { eventId: string; calendarId: string; googleId: string; syncedAt: string }
type RawLink = { event_id: string; calendar_id: string; google_id: string; synced_at: string }
const toLink = (r: RawLink): Link => ({ eventId: r.event_id, calendarId: r.calendar_id, googleId: r.google_id, syncedAt: r.synced_at })

export async function allLinks(db: GcalD1): Promise<Link[]> {
  const r = await db.prepare('SELECT event_id, calendar_id, google_id, synced_at FROM eg_gcal_links').bind().all<RawLink>()
  return (r.results ?? []).map(toLink)
}

export async function saveLink(db: GcalD1, link: Link): Promise<void> {
  await db.prepare('DELETE FROM eg_gcal_links WHERE event_id = ?1 OR (calendar_id = ?2 AND google_id = ?3)').bind(link.eventId, link.calendarId, link.googleId).run()
  await db.prepare('INSERT INTO eg_gcal_links (event_id, calendar_id, google_id, synced_at) VALUES (?1, ?2, ?3, ?4)').bind(link.eventId, link.calendarId, link.googleId, link.syncedAt).run()
}

export async function dropLink(db: GcalD1, eventId: string): Promise<void> {
  await db.prepare('DELETE FROM eg_gcal_links WHERE event_id = ?1').bind(eventId).run()
}

export async function addLog(db: GcalD1, level: 'info' | 'conflict' | 'error', message: string, at: string): Promise<void> {
  await db.prepare('INSERT INTO eg_gcal_log (at, level, message) VALUES (?1, ?2, ?3)').bind(at, level, message.slice(0, 500)).run()
  await db.prepare('DELETE FROM eg_gcal_log WHERE id NOT IN (SELECT id FROM eg_gcal_log ORDER BY id DESC LIMIT 200)').bind().run()
}

export async function readLog(db: GcalD1, limit = 50): Promise<{ at: string; level: string; message: string }[]> {
  const r = await db.prepare('SELECT at, level, message FROM eg_gcal_log ORDER BY id DESC LIMIT ?1').bind(limit).all<{ at: string; level: string; message: string }>()
  return r.results ?? []
}
