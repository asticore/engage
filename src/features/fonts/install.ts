/**
 * Installing a Fontsource or Google font: validate the request against the
 * font's metadata, then (for locally hosted fonts) copy each woff2 file into R2.
 *
 * The planning step is pure so the rules can be tested without a network.
 * The orchestration takes its fetch and storage as arguments so the route
 * stays a thin adapter.
 */
import {
  detectFontFormat,
  fontFileKey,
  FONT_SUBSETS,
  localFontFileName,
  localFontUrl,
  MAX_FONT_UPLOAD_BYTES,
  RESERVED_FONT_IDS,
  sanitizeFamily,
  sanitizeFontId,
  sanitizeSubsets,
  sanitizeVersion,
  sanitizeWeights,
} from './installed'
import { fontsourceFileUrl } from './css'
import type { FontSource, InstalledFont } from './types'

export const FONTSOURCE_META_URL = 'https://api.fontsource.org/v1/fonts'
/** jsDelivr's data API: the package's `tags.latest` is the version a new install pins. */
export const FONTSOURCE_PACKAGE_URL = 'https://data.jsdelivr.com/v1/package/npm/@fontsource'

/** The subset of the Fontsource v1 font record that installing needs. */
export type FontMetadata = {
  id: string
  family: string
  category?: string
  weights: number[]
  styles: string[]
  subsets: string[]
  type: string
}

export type InstallRequest = {
  weights?: unknown
  italic?: boolean
  local?: boolean
  /** Character subsets to install (for example ["latin", "cyrillic"]). Latin when omitted. */
  subsets?: unknown
}

export type InstallTarget = { weight: number; style: 'normal' | 'italic'; subset: string; key: string }

export type InstallPlan = {
  font: Omit<InstalledFont, 'files'>
  targets: InstallTarget[]
}

export type PlanResult = { ok: true; plan: InstallPlan } | { ok: false; status: number; error: string }

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>
type StoreFile = (key: string, data: Uint8Array, contentType: string) => Promise<void>

/** Reads a Fontsource metadata response. Returns null when the id is unknown. */
export async function fetchFontMetadata(id: string, fetchImpl: FetchLike = fetch): Promise<FontMetadata | null> {
  const response = await fetchImpl(`${FONTSOURCE_META_URL}/${encodeURIComponent(id)}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Fontsource metadata responded ${response.status}`)
  const raw = (await response.json()) as Record<string, unknown>
  const family = sanitizeFamily(raw.family)
  const fontId = sanitizeFontId(raw.id ?? id)
  if (!family || !fontId) return null
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  const meta: FontMetadata = {
    id: fontId,
    family,
    weights: sanitizeWeights(raw.weights),
    styles: strings(raw.styles),
    subsets: strings(raw.subsets),
    type: typeof raw.type === 'string' ? raw.type : 'other',
  }
  if (typeof raw.category === 'string') meta.category = raw.category
  return meta
}

/**
 * Checks an install request against the font's metadata and works out the
 * InstalledFont it would produce, plus the files a local install must fetch.
 */
export function planInstall(meta: FontMetadata, request: InstallRequest, version = ''): PlanResult {
  const requested = Array.isArray(request.weights) ? sanitizeWeights(request.weights) : []
  const weights = requested.length > 0 ? requested : meta.weights.includes(400) ? [400] : meta.weights.slice(0, 1)
  if (weights.length === 0) return { ok: false, status: 400, error: 'This font has no weights to install.' }
  const unavailable = weights.filter((w) => !meta.weights.includes(w))
  if (unavailable.length > 0) {
    return { ok: false, status: 400, error: `Weight ${unavailable.join(', ')} is not available for ${meta.family}.` }
  }

  const italic = request.italic === true
  if (italic && !meta.styles.includes('italic')) {
    return { ok: false, status: 400, error: `${meta.family} has no italic style.` }
  }
  const requestedSubsets = request.subsets === undefined ? [] : Array.isArray(request.subsets) ? request.subsets : null
  if (requestedSubsets === null || requestedSubsets.some((s) => !(FONT_SUBSETS as readonly unknown[]).includes(s))) {
    return { ok: false, status: 400, error: 'Choose subsets from the list: latin, latin-ext, cyrillic, greek or vietnamese.' }
  }
  const subsets = sanitizeSubsets(requestedSubsets)
  const missing = subsets.filter((subset) => !meta.subsets.includes(subset))
  if (missing.length > 0) {
    return { ok: false, status: 422, error: `${meta.family} has no ${missing.join(', ')} subset.` }
  }
  const pinned = sanitizeVersion(version)
  if (!pinned) return { ok: false, status: 502, error: `Could not read the Fontsource version of ${meta.family}. Try again.` }

  const styles: Array<'normal' | 'italic'> = italic ? ['normal', 'italic'] : ['normal']
  const targets: InstallTarget[] = []
  for (const subset of subsets) {
    for (const weight of weights) {
      for (const style of styles) targets.push({ weight, style, subset, key: fontFileKey(weight, style, subset) })
    }
  }

  const source: FontSource = meta.type === 'google' ? 'google' : 'fontsource'
  const font: Omit<InstalledFont, 'files'> = {
    id: meta.id,
    family: meta.family,
    source,
    weights,
    italic,
    local: request.local === true,
    version: pinned,
    subsets,
  }
  // Google's list of offered weights is what the stylesheet is checked against later.
  if (meta.weights.length > 0) font.available = meta.weights
  if (meta.category) font.category = meta.category
  return { ok: true, plan: { font, targets } }
}

/** The newest version of a Fontsource package, from jsDelivr's data API. Null when it cannot be read. */
export async function fetchFontsourceVersion(id: string, fetchImpl: FetchLike = fetch): Promise<string | null> {
  const response = await fetchImpl(`${FONTSOURCE_PACKAGE_URL}/${encodeURIComponent(id)}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) return null
  const raw = (await response.json().catch((): null => null)) as { tags?: { latest?: unknown } } | null
  return sanitizeVersion(raw?.tags?.latest)
}

/** Downloads one woff2 file of a pinned Fontsource package and checks it really is a WOFF2. */
export async function downloadFontFile(id: string, version: string, target: InstallTarget, fetchImpl: FetchLike = fetch): Promise<Uint8Array | null> {
  const response = await fetchImpl(fontsourceFileUrl({ id, version }, target.weight, target.style, target.subset), {
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) return null
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.length === 0 || bytes.length > MAX_FONT_UPLOAD_BYTES) return null
  return detectFontFormat(bytes) === 'woff2' ? bytes : null
}

export type InstallOutcome = { ok: true; font: InstalledFont } | { ok: false; status: number; error: string }

/**
 * Full install: metadata, plan, then (when local) download and store each file.
 * The result is what the admin UI merges into the form; nothing is saved to the
 * site settings here.
 */
export async function installFont(
  id: string,
  request: InstallRequest,
  deps: { fetch?: FetchLike; store?: StoreFile } = {},
): Promise<InstallOutcome> {
  if (RESERVED_FONT_IDS.includes(id)) {
    return { ok: false, status: 409, error: 'That font is already built into the theme.' }
  }
  const fetchImpl = deps.fetch ?? fetch
  const meta = await fetchFontMetadata(id, fetchImpl)
  if (!meta) return { ok: false, status: 404, error: 'Font not found in the Fontsource catalog.' }

  const version = await fetchFontsourceVersion(meta.id, fetchImpl)
  const planned = planInstall(meta, request, version ?? '')
  if (planned.ok === false) return planned

  const files: Record<string, string> = {}
  if (planned.plan.font.local) {
    if (!deps.store) return { ok: false, status: 500, error: 'Font storage is not configured.' }
    for (const target of planned.plan.targets) {
      const bytes = await downloadFontFile(meta.id, planned.plan.font.version ?? version ?? '', target, fetchImpl)
      if (!bytes) return { ok: false, status: 502, error: `Could not download ${target.key} for ${meta.family}.` }
      const fileName = localFontFileName(meta.id, target.weight, target.style, 'woff2', target.subset)
      await deps.store(fileName, bytes, 'font/woff2')
      files[target.key] = localFontUrl(fileName)
    }
  }
  return { ok: true, font: { ...planned.plan.font, files } }
}
