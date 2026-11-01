import type { CollectionAfterChangeHook } from '@/engine'
import { invalidateRedirectsCache } from './resolve'

/**
 * A 301 from the old address when a published post, product or event gets a new
 * slug. Pages are covered by the page tree, which makes the same redirect when a
 * page moves (admin-pages-tree). Pure part first, then the save hook.
 */

export type SlugRedirectCollection = 'posts' | 'products' | 'events'

/** The public address prefix each collection is served under (the sitemap and IndexNow use the same). */
export const SLUG_REDIRECT_PREFIX: Record<SlugRedirectCollection, string> = { posts: '/blog', products: '/shop', events: '/events' }

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
