/**
 * Internal link helpers for the SEO audit: which pages a document links to,
 * which pages nothing links to (orphans), and up to five link suggestions for a
 * page. Pure: no I/O and no AI. Suggestions are plain word matches on titles.
 */

import { extractForAnalysis } from './analysis/extract'
import { words } from './analysis/keyphrase'
import { pagePathOf } from './pagePath'

export { pagePathOf }

export const MAX_LINK_SUGGESTIONS = 5

const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'your', 'our', 'from', 'how', 'what', 'about', 'this', 'that', 'you', 'are', 'can'])

/** A site path for an internal href: no scheme, query or fragment, no trailing slash. Null for anything external. */
export function internalPathOf(href: string): string | null {
  const raw = href.trim()
  if (!raw || /^(mailto|tel):/i.test(raw)) return null
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) return null
  const bare = raw.split(/[?#]/)[0]
  const trimmed = bare.replace(/^\/+/, '').replace(/\/+$/, '')
  return trimmed === '' ? '/' : `/${trimmed}`
}

/** The distinct internal paths a document's content links to. Pure. */
export function internalTargetsOf(doc: Record<string, unknown>): string[] {
  const { links } = extractForAnalysis(doc)
  const out = new Set<string>()
  for (const link of links) {
    if (!link.internal) continue
    const path = internalPathOf(link.href)
    if (path) out.add(path)
  }
  return [...out]
}

/** A page no other document's content links to. The home page is never an orphan. */
export function isOrphan(path: string, linkedFromOthers: boolean): boolean {
  return path !== '/' && !linkedFromOthers
}

export type LinkCandidate = { title: string; href: string }

/**
 * Up to five other pages whose titles share words with this page's focus keyphrase
 * (or its title when no keyphrase is set). Pages already linked from this page are
 * left out, and so is the page itself. Most shared words first, then A to Z.
 */
export function suggestInternalLinks(
  source: { title: string; keyphrase: string; href: string; linksOut: ReadonlySet<string> },
  candidates: readonly LinkCandidate[],
): LinkCandidate[] {
  const query = [...new Set(words(source.keyphrase || source.title))].filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
  if (query.length === 0) return []
  const scored: { candidate: LinkCandidate; score: number }[] = []
  for (const candidate of candidates) {
    if (candidate.href === source.href || source.linksOut.has(candidate.href)) continue
    const titleWords = new Set(words(candidate.title))
    const score = query.filter((w) => titleWords.has(w)).length
    if (score > 0) scored.push({ candidate, score })
  }
  scored.sort((a, b) => b.score - a.score || a.candidate.title.localeCompare(b.candidate.title))
  return scored.slice(0, MAX_LINK_SUGGESTIONS).map((item) => item.candidate)
}
