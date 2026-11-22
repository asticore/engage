/**
 * Per-domain theme overrides (table eg_theme_domain_overrides, one row per host). Server only.
 * The table is created the first time an override is saved, the same way eg_theme_styles is, so a site that never
 * overrides a theme pays nothing. Loading never throws: a missing table or bad JSON reads as "no overrides".
 */
import { sanitizeThemeOverrides, NO_THEME_OVERRIDES, type ThemeOverrides } from './inherit'
import type { ThemeStylesD1 } from './store'

const CACHE_TTL_MS = 60_000
let cache: { at: number; map: Map<string, ThemeOverrides> } | null = null

async function defaultD1(): Promise<ThemeStylesD1> {
  const { rawD1 } = await import('@/features/ecommerce/server/db')
  return (await rawD1()) as unknown as ThemeStylesD1
}

const HOST_RE = /^[a-z0-9.-]{1,253}$/

/** Every host that has overrides, cached for a minute in this isolate. One query serves all hosts. */
export async function loadAllDomainOverrides(d1?: ThemeStylesD1): Promise<Map<string, ThemeOverrides>> {
  const now = Date.now()
  if (!d1 && cache && now - cache.at < CACHE_TTL_MS) return cache.map
  const map = new Map<string, ThemeOverrides>()
  try {
    const db = d1 ?? (await defaultD1())
    const rows = (await db.prepare('SELECT host, data FROM eg_theme_domain_overrides').bind().all<{ host: string; data: string }>()).results
    for (const row of rows) {
      try {
        map.set(row.host, sanitizeThemeOverrides(JSON.parse(row.data)))
      } catch {
        // A row with bad JSON is skipped: that domain inherits the master.
      }
    }
  } catch {
    // No table yet: nothing is overridden.
  }
  if (!d1) cache = { at: now, map }
  return map
}

export async function loadDomainOverrides(host: string, d1?: ThemeStylesD1): Promise<ThemeOverrides> {
  return (await loadAllDomainOverrides(d1)).get(host) ?? NO_THEME_OVERRIDES
}

/** Saves a host's overrides (cleaned first). Empty overrides remove the row. Returns what was stored. */
export async function saveDomainOverrides(host: string, input: unknown, d1?: ThemeStylesD1): Promise<ThemeOverrides> {
  if (!HOST_RE.test(host)) throw new Error('Not a valid host name.')
  const clean = sanitizeThemeOverrides(input)
  const db = d1 ?? (await defaultD1())
  await db.prepare('CREATE TABLE IF NOT EXISTS eg_theme_domain_overrides (host TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT)').bind().run()
  const empty = Object.keys(clean.colours).length === 0 && !clean.headingFont && !clean.bodyFont && clean.buttonRadius === null && clean.fieldRadius === null
  if (empty) await db.prepare('DELETE FROM eg_theme_domain_overrides WHERE host = ?1').bind(host).run()
  else await db.prepare('INSERT INTO eg_theme_domain_overrides (host, data, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(host) DO UPDATE SET data = ?2, updated_at = ?3').bind(host, JSON.stringify(clean), new Date().toISOString()).run()
  cache = null
  try {
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/', 'layout')
  } catch {
    // Outside a request scope (tests, scripts) there is nothing to revalidate.
  }
  return clean
}
