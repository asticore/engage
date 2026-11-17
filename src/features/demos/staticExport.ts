/**
 * Static HTML export (17g): pure helpers for turning crawled pages into a folder of plain files. No network or engine
 * imports, so the admin screen (browser) and the tests share them. The crawl itself lives in StaticExportPanel.
 */

export const MAX_EXPORT_PAGES = 300
export const MAX_EXPORT_ASSETS = 1500
export const MAX_EXPORT_BYTES = 150 * 1024 * 1024

/** A same-site reference as { pathname, search }, or null for anything that is not a file of this site. */
export function siteRef(raw: string, origin: string): { pathname: string; search: string } | null {
  const value = raw.trim()
  if (!value || value.startsWith('#') || /^(data|mailto|tel|javascript|blob):/i.test(value)) return null
  try {
    const url = new URL(value, origin + '/')
    if (url.origin !== origin) return null
    return { pathname: url.pathname, search: url.search }
  } catch {
    return null
  }
}

const hash = (s: string): string => {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif', 'image/gif': '.gif', 'image/svg+xml': '.svg',
  'text/css': '.css', 'font/woff2': '.woff2', 'font/woff': '.woff', 'application/javascript': '.js', 'image/x-icon': '.ico', 'image/vnd.microsoft.icon': '.ico',
}

/** Where a page lives in the folder: `/` is index.html, `/about` is about/index.html. */
export function pageFilePath(pathname: string): string {
  const clean = decodeURIComponent(pathname).replace(/\/+$/, '').replace(/^\/+/, '')
  return clean ? `${clean}/index.html` : 'index.html'
}

/** Where an asset lives in the folder. A query string becomes a short hash so two sizes of one picture stay apart. */
export function assetFilePath(pathname: string, search: string, contentType = ''): string {
  let path = decodeURIComponent(pathname).replace(/^\/+/, '').replace(/[^A-Za-z0-9._\-/]/g, '_')
  if (!path) path = 'asset'
  const type = contentType.split(';')[0].trim().toLowerCase()
  const ext = path.match(/\.[A-Za-z0-9]{1,5}$/)?.[0] ?? ''
  if (search) path = `${ext ? path.slice(0, -ext.length) : path}-${hash(search)}${ext}`
  if (!/\.[A-Za-z0-9]{1,5}$/.test(path)) path += EXT_BY_TYPE[type] ?? ''
  return `assets/${path}`
}

/** `../` steps from a file back to the folder root. */
export const rootPrefix = (filePath: string): string => '../'.repeat(Math.max(0, filePath.split('/').length - 1))

const ATTR_RE = /\b(href|src|poster|data-src)\s*=\s*("([^"]*)"|'([^']*)')/gi
const SRCSET_RE = /\bsrcset\s*=\s*("([^"]*)"|'([^']*)')/gi
const CSS_URL_RE = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi

/** Scripts are dropped from the export: the pages are plain HTML and CSS, and the app scripts need the live server. */
export function stripScripts(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<link\b[^>]*rel\s*=\s*["']?(?:preload|modulepreload|prefetch)["']?[^>]*as\s*=\s*["']?script["']?[^>]*>/gi, '')
    .replace(/<link\b[^>]*as\s*=\s*["']?script["']?[^>]*>/gi, '')
    .replace(/<link\b[^>]*rel\s*=\s*["']?modulepreload["']?[^>]*>/gi, '')
}

const splitSrcset = (value: string): { url: string; rest: string }[] =>
  value.split(',').map((part) => part.trim()).filter(Boolean).map((part) => {
    const [url, ...rest] = part.split(/\s+/)
    return { url, rest: rest.join(' ') }
  })

/** Every same-site file a page (or style sheet) points at, deduplicated, as `pathname + search`. */
export function collectRefs(text: string, origin: string, kind: 'html' | 'css'): string[] {
  const found = new Set<string>()
  const add = (raw: string | undefined) => {
    const ref = raw ? siteRef(raw, origin) : null
    if (ref) found.add(ref.pathname + ref.search)
  }
  if (kind === 'html') {
    for (const m of text.matchAll(ATTR_RE)) add(m[3] ?? m[4])
    for (const m of text.matchAll(SRCSET_RE)) for (const s of splitSrcset(m[2] ?? m[3] ?? '')) add(s.url)
  }
  for (const m of text.matchAll(CSS_URL_RE)) add(m[1] ?? m[2] ?? m[3])
  return [...found]
}

export type RefMap = {
  /** Pages that were crawled: `pathname` to file path. */
  pages: ReadonlyMap<string, string>
  /** Assets that were fetched: `pathname + search` to file path. */
  assets: ReadonlyMap<string, string>
}

/** Rewrites every reference in `text` (the file at `fromFile`) to a relative path. Unknown same-site links go to the first page. */
export function rewriteRefs(text: string, origin: string, fromFile: string, map: RefMap, kind: 'html' | 'css'): string {
  const prefix = rootPrefix(fromFile)
  const swap = (raw: string): string => {
    const ref = siteRef(raw, origin)
    if (!ref) return raw
    const hashPart = raw.includes('#') ? raw.slice(raw.indexOf('#')) : ''
    const asset = map.assets.get(ref.pathname + ref.search)
    if (asset) return prefix + asset + hashPart
    const page = map.pages.get(ref.pathname.replace(/\/+$/, '') || '/')
    if (page) return prefix + page + hashPart
    return raw
  }
  let out = text
  if (kind === 'html') {
    out = out.replace(ATTR_RE, (_all, attr: string, quoted: string, dq?: string, sq?: string) => {
      const q = quoted[0]
      return `${attr}=${q}${swap(dq ?? sq ?? '')}${q}`
    })
    out = out.replace(SRCSET_RE, (_all, quoted: string, dq?: string, sq?: string) => {
      const q = quoted[0]
      return `srcset=${q}${splitSrcset(dq ?? sq ?? '').map((s) => `${swap(s.url)}${s.rest ? ' ' + s.rest : ''}`).join(', ')}${q}`
    })
  }
  return out.replace(CSS_URL_RE, (_all, a?: string, b?: string, c?: string) => `url("${swap(a ?? b ?? c ?? '')}")`)
}

/** Page paths from a sitemap.xml body, same site only, in order, capped. */
export function sitemapPaths(xml: string, origin: string): string[] {
  const paths: string[] = []
  for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
    const ref = siteRef(m[1].replace(/&amp;/g, '&'), origin)
    if (ref && !paths.includes(ref.pathname)) paths.push(ref.pathname)
  }
  return paths.slice(0, MAX_EXPORT_PAGES)
}
