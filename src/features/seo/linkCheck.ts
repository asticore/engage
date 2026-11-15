/**
 * Task 21h: broken link checker. Pure helpers: which links the published content makes (and which documents
 * make them), which addresses may be fetched, and how a reply is judged. Fetching is in ./linkCheckRun.ts.
 */

import { extractForAnalysis } from './analysis/extract'

export type LinkSource = { collection: string; id: number | string; title: string }
export type CollectedLink = { href: string; internal: boolean; sources: LinkSource[] }

export const MAX_LINKS_PER_BATCH = 20
export const MAX_SOURCES_PER_LINK = 5

/** The address a link points at without query or fragment noise for display; internal links become site paths. */
export function normaliseHref(href: string): { href: string; internal: boolean } | null {
  const raw = href.trim()
  if (!raw || raw.startsWith('#') || /^(mailto|tel|sms|javascript|data):/i.test(raw)) return null
  if (/^https?:\/\//i.test(raw)) return { href: raw.split('#')[0], internal: false }
  if (raw.startsWith('//')) return { href: `https:${raw.split('#')[0]}`, internal: false }
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null
  const path = raw.split('#')[0]
  return { href: path.startsWith('/') ? path : `/${path}`, internal: true }
}

/** Every distinct link the given documents make, with up to five documents that make it. Pure. */
export function collectLinks(docs: Array<{ collection: string; doc: Record<string, unknown> }>): CollectedLink[] {
  const byHref = new Map<string, CollectedLink>()
  for (const { collection, doc } of docs) {
    const title = typeof doc.title === 'string' && doc.title ? doc.title : typeof doc.slug === 'string' ? doc.slug : String(doc.id ?? '')
    const { links } = extractForAnalysis(doc)
    for (const link of links) {
      const n = normaliseHref(link.href)
      if (!n) continue
      const entry = byHref.get(n.href) ?? { href: n.href, internal: n.internal, sources: [] }
      if (entry.sources.length < MAX_SOURCES_PER_LINK && !entry.sources.some((s) => s.collection === collection && String(s.id) === String(doc.id))) {
        entry.sources.push({ collection, id: doc.id as number | string, title })
      }
      byHref.set(n.href, entry)
    }
  }
  return [...byHref.values()].sort((a, b) => a.href.localeCompare(b.href))
}

export { judgeStatus, summariseLinks, type LinkResult, type LinkVerdict } from './linkCheckSummary'
