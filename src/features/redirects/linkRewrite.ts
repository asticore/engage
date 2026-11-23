import { invalidateRedirectsCache } from './resolve'

/**
 * When an address changes, links to the old address in other content point at the new one.
 * The pure part finds and rewrites link strings; the server part reads and writes the documents.
 * Only link fields are touched (keys named url, href, customUrl or ending in Url/Href, which covers
 * block links and rich text link nodes); visible text and slugs are never changed.
 */

export type AddressPair = { oldPath: string; newPath: string }

/** Sent by the admin editor when the editor chose to update the links on other pages. */
export const UPDATE_LINKS_HEADER = 'x-update-links'

const URL_KEY = /^(url|href|customUrl)$|Url$|Href$/
const SKIP_KEYS: ReadonlySet<string> = new Set(['id', 'slug', 'seo', 'createdAt', 'updatedAt', 'trashedAt'])
const MAX_DEPTH = 40

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/** The new link when `href` points at the old address (the address itself, or below it, with a query or fragment), else null. Longest old address wins. */
export function rewriteHref(href: string, pairs: AddressPair[]): string | null {
  const raw = href.trim()
  if (!raw.startsWith('/') || raw.startsWith('//')) return null
  let best: AddressPair | null = null
  for (const pair of pairs) {
    if (!pair.oldPath || pair.oldPath === '/' || pair.oldPath === pair.newPath) continue
    const old = pair.oldPath.replace(/\/+$/, '')
    const hit = raw === old || raw === `${old}/` || raw.startsWith(`${old}/`) || raw.startsWith(`${old}?`) || raw.startsWith(`${old}#`)
    if (hit && (!best || pair.oldPath.length > best.oldPath.length)) best = pair
  }
  if (!best) return null
  const old = best.oldPath.replace(/\/+$/, '')
  return best.newPath.replace(/\/+$/, '') + raw.slice(old.length)
}

/** Returns a copy of `value` with matching link strings rewritten, and how many were. Unchanged parts are shared. */
export function rewriteLinksInValue(value: unknown, pairs: AddressPair[], depth = 0): { value: unknown; count: number } {
  if (depth > MAX_DEPTH) return { value, count: 0 }
  if (Array.isArray(value)) {
    let count = 0
    let changed = false
    const next = value.map((item) => {
      const out = rewriteLinksInValue(item, pairs, depth + 1)
      count += out.count
      if (out.count > 0) changed = true
      return out.value
    })
    return { value: changed ? next : value, count }
  }
  if (!isRecord(value)) return { value, count: 0 }
  let count = 0
  let next: Record<string, unknown> | null = null
  for (const [key, child] of Object.entries(value)) {
    if (SKIP_KEYS.has(key)) continue
    let replaced: unknown = child
    if (typeof child === 'string') {
      if (URL_KEY.test(key)) {
        const rewritten = rewriteHref(child, pairs)
        if (rewritten !== null && rewritten !== child) {
          replaced = rewritten
          count += 1
        }
      }
    } else {
      const out = rewriteLinksInValue(child, pairs, depth + 1)
      if (out.count > 0) {
        replaced = out.value
        count += out.count
      }
    }
    if (replaced !== child) {
      next = next ?? { ...value }
      next[key] = replaced
    }
  }
  return { value: next ?? value, count }
}

export const LINK_REWRITE_COLLECTIONS = ['pages', 'posts', 'products', 'events', 'reusable-sections', 'page-templates', 'site-templates'] as const
export const LINK_REWRITE_GLOBALS = ['header', 'footer'] as const

type RewriteEngine = {
  find(args: Record<string, unknown>): Promise<{ docs: unknown[]; hasNextPage?: boolean }>
  update(args: Record<string, unknown>): Promise<unknown>
  findGlobal(args: Record<string, unknown>): Promise<unknown>
  updateGlobal(args: Record<string, unknown>): Promise<unknown>
}

const PAGE_SIZE = 250
const MAX_DOCS_PER_COLLECTION = 2000

/** The patch of changed top-level fields for one document, or null when nothing links to the old addresses. */
export function linkPatchFor(doc: Record<string, unknown>, pairs: AddressPair[]): { patch: Record<string, unknown>; count: number } | null {
  const patch: Record<string, unknown> = {}
  let count = 0
  for (const [key, child] of Object.entries(doc)) {
    if (SKIP_KEYS.has(key) || child === null || typeof child !== 'object') continue
    const out = rewriteLinksInValue(child, pairs)
    if (out.count > 0) {
      patch[key] = out.value
      count += out.count
    }
  }
  return count > 0 ? { patch, count } : null
}

/**
 * Rewrites links to the old addresses in every page, post, product, event, reusable section, template, and in the header and
 * footer. `skip` is the document that was just saved. A document that cannot be written is logged and the rest go on.
 * Returns how many links changed.
 */
export async function rewriteLinksToNewAddresses(pairs: AddressPair[], skip?: { collection: string; id: unknown }): Promise<number> {
  const live = pairs.filter((p) => p.oldPath && p.newPath && p.oldPath !== p.newPath)
  if (live.length === 0) return 0
  const { getEngine } = await import('@/lib/engine')
  const engine = (await getEngine()) as unknown as RewriteEngine
  let total = 0

  for (const collection of LINK_REWRITE_COLLECTIONS) {
    try {
      let seen = 0
      for (let page = 1; seen < MAX_DOCS_PER_COLLECTION; page += 1) {
        const result = await engine.find({ collection, depth: 0, limit: PAGE_SIZE, page, overrideAccess: true })
        for (const raw of result.docs) {
          seen += 1
          const doc = raw as Record<string, unknown>
          if (doc.trashedAt) continue
          if (skip && skip.collection === collection && String(skip.id) === String(doc.id)) continue
          const change = linkPatchFor(doc, live)
          if (!change) continue
          try {
            await engine.update({ collection, id: doc.id, data: change.patch, overrideAccess: true })
            total += change.count
          } catch (error) {
            console.error(`rewriteLinks: could not update ${collection} ${String(doc.id)}:`, error)
          }
        }
        if (!result.hasNextPage) break
      }
    } catch (error) {
      console.error(`rewriteLinks: could not read ${collection}:`, error)
    }
  }

  for (const slug of LINK_REWRITE_GLOBALS) {
    try {
      const doc = (await engine.findGlobal({ slug, depth: 0, overrideAccess: true })) as Record<string, unknown> | null
      const change = doc ? linkPatchFor(doc, live) : null
      if (!change) continue
      await engine.updateGlobal({ slug, data: change.patch, overrideAccess: true })
      total += change.count
    } catch (error) {
      console.error(`rewriteLinks: could not update global ${slug}:`, error)
    }
  }
  if (total > 0) invalidateRedirectsCache()
  return total
}
