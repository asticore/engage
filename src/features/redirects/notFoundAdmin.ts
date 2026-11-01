/**
 * Data for the Redirects screen's "404s" tab: the logged addresses, each with a
 * suggested target page (the same word match the SEO audit uses for link
 * suggestions), so the one-click create button has a sensible default.
 */

import { pagePathOf, suggestInternalLinks, type LinkCandidate } from '@/features/seo/internalLinks'
import { listNotFoundRows, type NotFoundRow } from './notFoundLog'

export type NotFoundTabRow = NotFoundRow & { suggestion: string | null }

export type PageFinder = {
  find(args: { collection: string; where?: Record<string, unknown>; limit?: number; depth?: number; overrideAccess?: boolean }): Promise<{ docs: unknown[] }>
}

/** The log rows with a suggested target each. Without page access the suggestions are left empty. */
export async function loadNotFoundTab(engine: PageFinder | null, canReadPages: boolean, limit = 200): Promise<NotFoundTabRow[]> {
  const rows = await listNotFoundRows(limit)
  let candidates: LinkCandidate[] = []
  if (engine && canReadPages && rows.length > 0) {
    const { docs } = await engine.find({ collection: 'pages', where: { _status: { equals: 'published' } }, limit: 500, depth: 0, overrideAccess: true })
    const pages = docs as Record<string, unknown>[]
    const byId = new Map(pages.map((page) => [String(page.id), page]))
    candidates = pages
      .filter((page) => page.isHomepage !== true)
      .map((page) => ({ title: String(page.title ?? page.slug ?? ''), href: pagePathOf(page, (id) => byId.get(id)) ?? '' }))
      .filter((candidate) => candidate.href && candidate.href !== '/')
  }
  return rows.map((row) => {
    const words = row.path.replace(/[-_/]+/g, ' ').trim()
    const [best] = suggestInternalLinks({ title: words, keyphrase: '', href: row.path, linksOut: new Set() }, candidates)
    return { ...row, suggestion: best?.href ?? null }
  })
}
