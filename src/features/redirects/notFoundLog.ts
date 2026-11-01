/**
 * The 404 log: every public address that answered "page not found", with how
 * often it was hit, when it was last seen and the last referrer (query string
 * removed). The Redirects screen lists it under "404s", where an admin turns a row
 * into a redirect in one click.
 *
 * Rate limit: a path is written to D1 at most once a minute per server instance.
 * The hits in between are counted in memory and added to the next write, so the
 * count stays right while a flood of requests for one address writes one row.
 * Bots probing many addresses are kept in check by pruning rows not seen for 90 days.
 */

import { normalizePath } from './validate'
import { getRedirectsD1 } from './resolve'

export const NOT_FOUND_WRITE_INTERVAL_MS = 60_000
export const NOT_FOUND_RETENTION_MS = 90 * 24 * 60 * 60 * 1000
const MAX_PATH_LENGTH = 500
const MAX_REFERRER_LENGTH = 500
const MAX_TRACKED_PATHS = 2000

type Pending = { hits: number; lastWrite: number }
const pending = new Map<string, Pending>()

const SKIPPED_PREFIX = /^\/(api|_next|admin|_static|__)(\/|$)/i
const STATIC_FILE = /\.(png|jpe?g|gif|webp|avif|svg|ico|css|js|mjs|map|txt|json|woff2?|ttf|otf|mp3|mp4|webm|pdf|zip)$/i

/** The path stored for a 404, or null when it is not worth logging (assets, the API, too long). */
export function notFoundPathOf(raw: string | null | undefined): string | null {
  if (!raw) return null
  const bare = raw.split(/[?#]/)[0]
  if (!bare.startsWith('/') || bare.startsWith('//') || bare.length > MAX_PATH_LENGTH) return null
  if (SKIPPED_PREFIX.test(bare) || STATIC_FILE.test(bare)) return null
  return normalizePath(bare)
}

/** A referrer without its query string or fragment, or null when there is none. */
export function referrerOf(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw)
    return `${url.origin}${url.pathname}`.slice(0, MAX_REFERRER_LENGTH)
  } catch {
    return null
  }
}

/**
 * Counts one 404 for `rawPath` and writes the row when the rate limit allows it.
 * Never throws: a log that cannot be written must not break the error page.
 */
export async function recordNotFound(rawPath: string | null | undefined, rawReferrer?: string | null, now: number = Date.now()): Promise<void> {
  try {
    const path = notFoundPathOf(rawPath)
    if (!path) return
    if (!pending.has(path) && pending.size >= MAX_TRACKED_PATHS) pending.clear()
    const entry = pending.get(path) ?? { hits: 0, lastWrite: 0 }
    entry.hits += 1
    pending.set(path, entry)
    if (now - entry.lastWrite < NOT_FOUND_WRITE_INTERVAL_MS) return

    const hits = entry.hits
    entry.hits = 0
    entry.lastWrite = now
    const db = await getRedirectsD1()
    if (!db) return
    const iso = new Date(now).toISOString()
    await db
      .prepare(
        'INSERT INTO eg_not_found_log (path, hit_count, last_seen, referrer) VALUES (?, ?, ?, ?) ' +
          'ON CONFLICT(path) DO UPDATE SET hit_count = hit_count + excluded.hit_count, last_seen = excluded.last_seen, referrer = COALESCE(excluded.referrer, referrer)',
      )
      .bind(path, hits, iso, referrerOf(rawReferrer))
      .run()
    if (Math.random() < 0.01) {
      await db.prepare('DELETE FROM eg_not_found_log WHERE last_seen < ?').bind(new Date(now - NOT_FOUND_RETENTION_MS).toISOString()).run()
    }
  } catch {
    // The 404 log is best-effort.
  }
}

export type NotFoundRow = { id: number; path: string; hitCount: number; lastSeen: string; referrer: string | null }

/** The logged 404s, most hit first. Empty when the table or D1 is missing. */
export async function listNotFoundRows(limit = 200): Promise<NotFoundRow[]> {
  try {
    const db = await getRedirectsD1()
    if (!db) return []
    const result = await db
      .prepare('SELECT id, path, hit_count, last_seen, referrer FROM eg_not_found_log ORDER BY hit_count DESC, last_seen DESC LIMIT ?')
      .bind(limit)
      .all()
    return ((result.results ?? []) as { id: number; path: string; hit_count: number; last_seen: string; referrer: string | null }[]).map((row) => ({
      id: row.id,
      path: row.path,
      hitCount: Number(row.hit_count) || 0,
      lastSeen: row.last_seen,
      referrer: row.referrer ?? null,
    }))
  } catch {
    return []
  }
}

/** One logged 404 by id, or null. */
export async function findNotFoundRow(id: number): Promise<NotFoundRow | null> {
  const db = await getRedirectsD1()
  if (!db) return null
  const row = (await db.prepare('SELECT id, path, hit_count, last_seen, referrer FROM eg_not_found_log WHERE id = ?').bind(id).first()) as
    | { id: number; path: string; hit_count: number; last_seen: string; referrer: string | null }
    | null
  return row ? { id: row.id, path: row.path, hitCount: Number(row.hit_count) || 0, lastSeen: row.last_seen, referrer: row.referrer ?? null } : null
}

/** Removes one logged 404 (after it became a redirect, or when dismissed). */
export async function deleteNotFoundRow(id: number): Promise<void> {
  const db = await getRedirectsD1()
  if (!db) return
  await db.prepare('DELETE FROM eg_not_found_log WHERE id = ?').bind(id).run()
}

/** Test helper: forget the in-memory rate limit. */
export function __resetNotFoundLogForTests(): void {
  pending.clear()
}
