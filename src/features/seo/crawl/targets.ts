import { publicPath } from '@/features/pagespeed/target'

import { collectTargets } from './runner'
import type { CrawlTarget } from './store'

type EngineLike = { find: (args: Record<string, unknown>) => Promise<{ docs: unknown[] }> }

const slugOf = (doc: Record<string, unknown>): string => (typeof doc.slug === 'string' ? doc.slug : '')

/**
 * Every address a crawl visits, with the page, post, product or event each belongs to when one can be found, so
 * a row can link to its editor. Sitemap entries of posts, products and events are matched by the last part of the address.
 */
export async function buildCrawlTargets(engine: EngineLike, origin: string, sitemapUrls: string[]): Promise<CrawlTarget[]> {
  const targets = await collectTargets(engine, origin, sitemapUrls, async (docs) => {
    const byId = new Map(docs.map((d) => [String(d.id), d]))
    const out: { path: string; id: number }[] = []
    for (const doc of docs) {
      const path = await publicPath('pages', doc, async (id) => byId.get(String(id)) ?? null)
      if (path) out.push({ path, id: Number(doc.id) })
    }
    return out
  })
  const bySlug = new Map<string, { collection: string; id: number }>()
  for (const collection of ['posts', 'products', 'events']) {
    const { docs } = await engine.find({ collection, where: { _status: { equals: 'published' } }, limit: 500, depth: 0, overrideAccess: true }).catch((): { docs: unknown[] } => ({ docs: [] }))
    for (const doc of docs as Record<string, unknown>[]) {
      const slug = slugOf(doc)
      if (slug && !bySlug.has(slug)) bySlug.set(slug, { collection, id: Number(doc.id) })
    }
  }
  for (const target of targets) {
    if (target.collection) continue
    const last = decodeURIComponent(target.path.split('/').filter(Boolean).pop() ?? '')
    const found = bySlug.get(last)
    if (found && target.path !== '/') {
      target.collection = found.collection
      target.docId = found.id
    }
  }
  return targets
}
