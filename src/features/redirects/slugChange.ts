import type { CollectionAfterChangeHook } from '@/engine'
import { pagePathOf } from '@/features/seo/pagePath'
import { invalidateRedirectsCache } from './resolve'

/**
 * A 301 from the old address when a published post, product or event gets a new
 * slug. Pages are covered by the page tree, which makes the same redirect when a
 * page moves (admin-pages-tree). Pure part first, then the save hook.
 */

export type SlugRedirectCollection = 'posts' | 'products' | 'events' | 'courses'

/** The public address prefix each collection is served under (the sitemap and IndexNow use the same). */
export const SLUG_REDIRECT_PREFIX: Record<SlugRedirectCollection, string> = { posts: '/blog', products: '/shop', events: '/events', courses: '/courses' }

/** The old and new paths when the slug changed, or null when there is nothing to redirect. */
export function slugRedirectPaths(collection: SlugRedirectCollection, oldSlug: unknown, newSlug: unknown): { fromPath: string; toPath: string } | null {
  if (typeof oldSlug !== 'string' || typeof newSlug !== 'string') return null
  const from = oldSlug.trim()
  const to = newSlug.trim()
  if (!from || !to || from === to) return null
  return { fromPath: `${SLUG_REDIRECT_PREFIX[collection]}/${from}`, toPath: `${SLUG_REDIRECT_PREFIX[collection]}/${to}` }
}

type SlugDoc = { id?: unknown; slug?: unknown; _status?: unknown }

/** afterChange: a published document whose slug changed gets a 301 from its old address, unless one already exists. */
export const slugRedirectAfterChange =
  (collection: SlugRedirectCollection): CollectionAfterChangeHook =>
  async ({ doc, previousDoc }) => {
    try {
      const record = doc as SlugDoc | null
      const before = previousDoc as SlugDoc | null | undefined
      if (!record || !before) return doc
      if (record._status !== 'published' || before._status !== 'published') return doc
      const paths = slugRedirectPaths(collection, before.slug, record.slug)
      if (!paths) return doc

      const { getEngine } = await import('@/lib/engine')
      const engine = await getEngine()
      const existing = await engine.find({
        collection: 'redirects',
        where: { fromPath: { equals: paths.fromPath } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (existing.docs.length > 0) return doc

      await engine.create({
        collection: 'redirects',
        data: { fromPath: paths.fromPath, toPath: paths.toPath, redirectType: '301', note: 'Created when the address changed' },
        overrideAccess: true,
      })
      invalidateRedirectsCache()
    } catch (error) {
      // The save has already happened; a redirect that cannot be written is logged, not raised.
      console.error('slugRedirectAfterChange error:', error)
    }
    return doc
  }

type PageDoc = { id?: unknown; slug?: unknown; parent?: unknown; isHomepage?: unknown; _status?: unknown }
const MAX_PAGE_DEPTH = 8

const pageParentId = (page: PageDoc): string | null => {
  const parent = page.parent
  const id = parent && typeof parent === 'object' ? (parent as { id?: unknown }).id : parent
  return id === undefined || id === null || id === '' ? null : String(id)
}

/**
 * afterChange for pages: when a page's slug changes in the page editor, a 301 is
 * made from the old address of the page and of each published page below it, the
 * same redirects the page tree makes when a page moves. Parent changes are the
 * tree's job, so only a slug change starts this. Returns quietly when the chain
 * to the root cannot be read.
 */
export const pageSlugRedirectAfterChange: CollectionAfterChangeHook = async ({ doc, previousDoc }) => {
  try {
    const record = doc as PageDoc | null
    const before = previousDoc as PageDoc | null | undefined
    if (!record || !before || typeof record.id === 'undefined') return doc
    if (record._status !== 'published' || before._status !== 'published') return doc
    if (record.isHomepage === true || before.slug === record.slug) return doc

    const { getEngine } = await import('@/lib/engine')
    const engine = await getEngine()
    const pagesById = new Map<string, PageDoc>([[String(record.id), record]])
    const fetchPage = async (id: string): Promise<PageDoc | undefined> => {
      if (pagesById.has(id)) return pagesById.get(id)
      const found = await engine.find({ collection: 'pages', where: { id: { equals: id } }, limit: 1, depth: 0, overrideAccess: true })
      const page = (found.docs[0] as PageDoc | undefined) ?? undefined
      if (page) pagesById.set(id, page)
      return page
    }

    // Ancestors up to the root: the new path cannot be built without them.
    let parentId = pageParentId(record)
    for (let depth = 0; parentId && depth < MAX_PAGE_DEPTH; depth += 1) {
      const parent = await fetchPage(parentId)
      if (!parent) return doc
      parentId = pageParentId(parent)
    }

    // Published descendants, level by level.
    let level = [String(record.id)]
    for (let depth = 0; level.length > 0 && depth < MAX_PAGE_DEPTH; depth += 1) {
      const children = await engine.find({
        collection: 'pages',
        where: { parent: { in: level } },
        limit: 500,
        depth: 0,
        overrideAccess: true,
      })
      level = []
      for (const child of children.docs as PageDoc[]) {
        if (child.id === undefined || pagesById.has(String(child.id))) continue
        pagesById.set(String(child.id), child)
        level.push(String(child.id))
      }
    }

    const lookup = (id: string) => pagesById.get(id) as Record<string, unknown> | undefined
    const newPrefix = pagePathOf(record as Record<string, unknown>, lookup)
    const oldPrefix = pagePathOf({ ...record, slug: before.slug } as Record<string, unknown>, lookup)
    if (!newPrefix || !oldPrefix) return doc

    let created = 0
    for (const page of pagesById.values()) {
      if (page._status !== 'published' && String(page.id) !== String(record.id)) continue
      const newPath = pagePathOf(page as Record<string, unknown>, lookup)
      if (!newPath || !newPath.startsWith(newPrefix)) continue
      const oldPath = oldPrefix + newPath.slice(newPrefix.length)
      if (oldPath === newPath || oldPath === '/') continue
      const existing = await engine.find({ collection: 'redirects', where: { fromPath: { equals: oldPath } }, limit: 1, depth: 0, overrideAccess: true })
      if (existing.docs.length > 0) continue
      await engine.create({
        collection: 'redirects',
        data: { fromPath: oldPath, toPath: newPath, redirectType: '301', note: 'Created when the page slug changed in the editor' },
        overrideAccess: true,
      })
      created += 1
    }
    if (created > 0) invalidateRedirectsCache()
  } catch (error) {
    console.error('pageSlugRedirectAfterChange error:', error)
  }
  return doc
}
