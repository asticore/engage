/**
 * What a crawl stores for each page (one JSON column) and the columns the audit table shows.
 * Pure: turns the parsed HTML facts into the compact stored form.
 */

import { detectSnippetTypes } from '../snippets'
import type { HtmlFacts } from './htmlFacts'
import type { SlimFacts } from './issues'

export type StoredPage = SlimFacts & {
  lang: string
  h1Count: number
  h2Count: number
  readingMinutes: number
  imageCount: number
  imagesMissingAlt: number
  jsonLdTypes: string[]
  snippetTypes: string[]
  ogComplete: boolean
}

const MAX_LINKS = 250
const clip = (text: string, max: number): string => (text.length > max ? text.slice(0, max) : text)

/** The `@type` names found in JSON-LD blocks, including those inside an `@graph`. */
export function jsonLdTypesOf(blocks: unknown[]): string[] {
  const found = new Set<string>()
  const visit = (node: unknown, depth: number): void => {
    if (!node || typeof node !== 'object' || depth > 4) return
    if (Array.isArray(node)) return void node.forEach((n) => visit(n, depth + 1))
    const record = node as Record<string, unknown>
    const type = record['@type']
    if (typeof type === 'string') found.add(type)
    else if (Array.isArray(type)) for (const t of type) if (typeof t === 'string') found.add(t)
    if (Array.isArray(record['@graph'])) visit(record['@graph'], depth + 1)
  }
  blocks.forEach((b) => visit(b, 0))
  return [...found].slice(0, 20)
}

export function toStoredPage(facts: HtmlFacts): StoredPage {
  const hrefs = [...new Set(facts.links.map((l) => l.href.trim()).filter(Boolean))].slice(0, MAX_LINKS)
  return {
    robots: facts.robots,
    canonical: facts.canonical,
    hreflang: facts.hreflang.slice(0, 30),
    title: clip(facts.title, 300),
    metaDescription: facts.metaDescription === null ? null : clip(facts.metaDescription, 500),
    wordCount: facts.wordCount,
    hash: facts.hash,
    headings: facts.headings.slice(0, 60).map((h) => ({ level: h.level, text: clip(h.text, 120) })),
    links: hrefs.map((href) => ({ href: clip(href, 300) })),
    lang: facts.lang,
    h1Count: facts.headings.filter((h) => h.level === 1).length,
    h2Count: facts.headings.filter((h) => h.level === 2).length,
    readingMinutes: Math.max(1, Math.round(facts.wordCount / 230)),
    imageCount: facts.images.length,
    imagesMissingAlt: facts.images.filter((i) => !i.decorative && !(i.alt ?? '').trim()).length,
    jsonLdTypes: jsonLdTypesOf(facts.jsonLd),
    snippetTypes: detectSnippetTypes(facts).filter((d) => d.state !== 'missing').map((d) => d.id),
    ogComplete: Boolean(facts.og['og:title'] && facts.og['og:image']),
  }
}
