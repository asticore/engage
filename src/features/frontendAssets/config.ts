/**
 * Extra stylesheets and scripts a site owner adds to the public site and the customer portal (Bootstrap,
 * Tailwind, Font Awesome, a widget). Front end only: the admin never loads them. Pure (no database, no
 * request), shared by the admin screen, the layout, the CSP and the tests.
 */
import type { AssetKind } from './builtin'
import { fontAwesomeCsp, fontAwesomeTag, normaliseFontAwesome, validateFontAwesome, type FontAwesomeConfig } from './fontAwesome'

export type FrontendAsset = {
  id: string
  label: string
  kind: AssetKind
  url: string
  /** Optional Subresource Integrity value (sha256, sha384 or sha512). A file that does not match is not run or applied. */
  integrity: string
  /** Where the tag is written: in the head, or at the end of the body (scripts only). */
  position: 'head' | 'body'
  /** Scripts only. */
  defer: boolean
  async: boolean
  /** Which pages get it. */
  scope: 'everywhere' | 'site' | 'portal'
  enabled: boolean
}

export type FrontendAssetsConfig = { assets: FrontendAsset[]; /** The owner's own Font Awesome Pro licence (Task 12, 31g). Absent means the free built-in icons only. */ fontAwesome?: FontAwesomeConfig }

export const EMPTY_FRONTEND_ASSETS: FrontendAssetsConfig = { assets: [] }
export const MAX_ASSETS = 30
const INTEGRITY = /^(sha256|sha384|sha512)-[A-Za-z0-9+/]{43,100}={0,2}$/

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** The address as a normalised https URL, or null when it is not a plain https address. */
export function cleanUrl(value: unknown): string | null {
  const raw = text(value, 2000)
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.')) return null
    return url.toString()
  } catch {
    return null
  }
}

/** Drops anything that is not a plain entry, so a stored or posted value cannot smuggle structure. */
export function normaliseAssets(input: unknown): FrontendAssetsConfig {
  const raw = (input && typeof input === 'object' ? input : {}) as { assets?: unknown }
  const list = Array.isArray(raw.assets) ? raw.assets : []
  const assets: FrontendAsset[] = []
  const seen = new Set<string>()
  for (const item of list.slice(0, MAX_ASSETS)) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const url = cleanUrl(r.url)
    if (!url) continue
    const kind: AssetKind = r.kind === 'js' ? 'js' : 'css'
    const integrity = text(r.integrity, 200)
    let id = text(r.id, 40).replace(/[^a-zA-Z0-9_-]/g, '')
    if (!id || seen.has(id)) id = `a${assets.length + 1}-${Math.random().toString(36).slice(2, 7)}`
    seen.add(id)
    assets.push({
      id,
      label: text(r.label, 80) || new URL(url).hostname,
      kind,
      url,
      integrity: INTEGRITY.test(integrity) ? integrity : '',
      position: kind === 'js' && r.position === 'body' ? 'body' : 'head',
      defer: kind === 'js' && r.defer !== false,
      async: kind === 'js' && r.async === true,
      scope: r.scope === 'site' || r.scope === 'portal' ? r.scope : 'everywhere',
      enabled: r.enabled !== false,
    })
  }
  const fontAwesome = normaliseFontAwesome((input as { fontAwesome?: unknown } | null)?.fontAwesome)
  return fontAwesome.mode === 'off' ? { assets } : { assets, fontAwesome }
}

/** A message for the first problem in a posted list, or null. Run on the raw input before normalising. */
export function validateAssets(input: unknown): string | null {
  const list = (input && typeof input === 'object' ? (input as { assets?: unknown }).assets : null)
  const faProblem = validateFontAwesome((input as { fontAwesome?: unknown } | null)?.fontAwesome)
  if (faProblem) return faProblem
  if (!Array.isArray(list)) return null
  if (list.length > MAX_ASSETS) return `At most ${MAX_ASSETS} files can be added.`
  for (const item of list) {
    const r = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const label = text(r.label, 80) || text(r.url, 80)
    if (!cleanUrl(r.url)) return `"${label}": the address must start with https:// and name a website.`
    const integrity = text(r.integrity, 200)
    if (integrity && !INTEGRITY.test(integrity)) return `"${label}": the integrity value must look like sha384-... (base64).`
  }
  return null
}

const matches = (asset: FrontendAsset, portal: boolean): boolean => asset.enabled && (asset.scope === 'everywhere' || (portal ? asset.scope === 'portal' : asset.scope === 'site'))

/** The enabled entries for this kind of page, split by where they are written. */
export function assetsFor(config: FrontendAssetsConfig, portal: boolean): { css: FrontendAsset[]; headScripts: FrontendAsset[]; bodyScripts: FrontendAsset[] } {
  const live = config.assets.filter((a) => matches(a, portal))
  const fa = config.fontAwesome ? fontAwesomeTag(config.fontAwesome) : null
  if (fa) live.push({ id: 'font-awesome-pro', label: 'Font Awesome Pro', kind: fa.kind, url: fa.url, integrity: '', position: 'head', defer: false, async: false, scope: 'everywhere', enabled: true })
  return {
    css: live.filter((a) => a.kind === 'css'),
    headScripts: live.filter((a) => a.kind === 'js' && a.position === 'head'),
    bodyScripts: live.filter((a) => a.kind === 'js' && a.position === 'body'),
  }
}

export type AssetCsp = { script: string[]; style: string[]; font: string[] }

/** Hosts the enabled entries need in the Content-Security-Policy. Stylesheets can pull fonts and images from their own host. */
export function assetCspAdditions(config: FrontendAssetsConfig): AssetCsp {
  const out: AssetCsp = { script: [], style: [], font: [] }
  for (const a of config.assets) {
    if (!a.enabled) continue
    const origin = new URL(a.url).origin
    if (a.kind === 'js') out.script.push(origin)
    else {
      out.style.push(origin)
      out.font.push(origin)
    }
  }
  if (config.fontAwesome) {
    const fa = fontAwesomeCsp(config.fontAwesome)
    out.script.push(...fa.script)
    out.style.push(...fa.style)
    out.font.push(...fa.font)
  }
  return { script: [...new Set(out.script)], style: [...new Set(out.style)], font: [...new Set(out.font)] }
}

/** Adds the hosts to the named directives; a directive covered only by default-src is created from it. A policy with neither is left alone. */
export function extendPolicy(policy: string, add: AssetCsp): string {
  if (!add.script.length && !add.style.length && !add.font.length) return policy
  const directives = policy.split(';').map((d) => d.trim()).filter(Boolean)
  const find = (name: string) => directives.findIndex((d) => d.toLowerCase().split(/\s+/)[0] === name)
  const defaultIndex = find('default-src')
  const apply = (name: string, sources: string[]) => {
    if (!sources.length) return
    const index = find(name)
    let base: string[]
    if (index >= 0) base = directives[index]!.split(/\s+/).slice(1)
    else if (defaultIndex >= 0) base = directives[defaultIndex]!.split(/\s+/).slice(1)
    else return
    if (base.includes("'none'")) base = base.filter((s) => s !== "'none'")
    const text2 = `${name} ${[...base, ...sources.filter((s) => !base.includes(s))].join(' ')}`
    if (index >= 0) directives[index] = text2
    else directives.push(text2)
  }
  apply('script-src', add.script)
  apply('style-src', add.style)
  apply('font-src', add.font)
  return directives.join('; ')
}
