import { AUDIT_COLLECTIONS, ORPHAN_PROBLEM, buildAuditRow, type AuditCollection, type AuditRow } from './audit'
import { isOrphan, internalTargetsOf, pagePathOf, suggestInternalLinks, type LinkCandidate } from './internalLinks'

/** Most documents read per collection. Anything beyond this is not audited. */
export const AUDIT_LIMIT_PER_COLLECTION = 500

export type AuditFindEngine = {
  find(args: {
    collection: string
    where?: Record<string, unknown>
    limit?: number
    depth?: number
    overrideAccess?: boolean
  }): Promise<{ docs: unknown[] }>
}


const asText = (value: unknown): string => (typeof value === 'string' ? value : '')

/**
 * Reads the published, non-trashed documents of each collection and turns the
 * ones the caller may see into audit rows. Every collection is read (with
 * overrideAccess) so the link graph is complete: a page is an orphan only when
 * no content at all links to it. Only the allowed collections become rows, and
 * link suggestions use page titles, which only a reader of pages gets.
 */
export async function loadAuditRows(
  engine: AuditFindEngine,
  collections: readonly AuditCollection[] = AUDIT_COLLECTIONS,
): Promise<AuditRow[]> {
  const docsOf = new Map<AuditCollection, Record<string, unknown>[]>()
  for (const collection of AUDIT_COLLECTIONS) {
    const { docs } = await engine.find({
      collection,
      where: { _status: { equals: 'published' } },
      limit: AUDIT_LIMIT_PER_COLLECTION,
      depth: 0,
      overrideAccess: true,
    })
    docsOf.set(
      collection,
      (docs as Record<string, unknown>[]).filter((doc) => !doc.trashedAt),
    )
  }

  // Page paths from the parent chain of the pages read, and the links every document makes.
  const pages = docsOf.get('pages') ?? []
  const pagesById = new Map(pages.map((doc) => [String(doc.id), doc]))
  const lookup = (id: string) => pagesById.get(id)
  const pathOf = new Map<string, string>()
  for (const page of pages) {
    const path = pagePathOf(page, lookup)
    if (path) pathOf.set(String(page.id), path)
  }

  // target path -> keys of the documents that link to it, and each document's own link targets.
  const linkedFrom = new Map<string, Set<string>>()
  const linksOut = new Map<string, Set<string>>()
  for (const collection of AUDIT_COLLECTIONS) {
    for (const doc of docsOf.get(collection) ?? []) {
      const key = `${collection}-${String(doc.id)}`
      const targets = new Set(internalTargetsOf(doc))
      linksOut.set(key, targets)
      for (const target of targets) linkedFrom.set(target, new Set([...(linkedFrom.get(target) ?? []), key]))
    }
  }

  // Candidates for suggestions: published pages with a path, not hidden from search engines.
  const candidates: LinkCandidate[] = []
  for (const page of pages) {
    const path = pathOf.get(String(page.id))
    const seo = (page.seo && typeof page.seo === 'object' ? page.seo : {}) as Record<string, unknown>
    if (!path || page.isHomepage === true || seo.noIndex === true) continue
    candidates.push({ title: asText(page.title) || asText(page.slug), href: path })
  }

  const rows: AuditRow[] = []
  for (const collection of AUDIT_COLLECTIONS) {
    if (!collections.includes(collection)) continue
    for (const doc of docsOf.get(collection) ?? []) {
      const row = buildAuditRow(doc, collection)
      if (collection === 'pages') {
        const path = pathOf.get(String(doc.id))
        if (path) {
          const key = `pages-${String(doc.id)}`
          const own = linksOut.get(key) ?? new Set<string>()
          // A page that only links to itself is still an orphan: self-links do not count.
          const linkedByOthers = [...(linkedFrom.get(path) ?? [])].some((source) => source !== key)
          if (isOrphan(path, linkedByOthers)) {
            row.orphan = true
            row.problems.push(ORPHAN_PROBLEM)
          }
          const seo = (doc.seo && typeof doc.seo === 'object' ? doc.seo : {}) as Record<string, unknown>
          const others = candidates.filter((c) => c.href !== path)
          row.linkSuggestions = suggestInternalLinks(
            { title: row.title, keyphrase: asText(seo.focusKeyphrase), href: path, linksOut: own },
            others,
          ).map((c) => ({ title: c.title, href: c.href }))
        }
      }
      rows.push(row)
    }
  }
  return rows
}
