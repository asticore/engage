import { AUDIT_COLLECTIONS, ORPHAN_PROBLEM, buildAuditRow, type AuditCollection, type AuditRow } from './audit'
import { internalPathOf, isOrphan, internalTargetsOf, pagePathOf, suggestInternalLinks, type LinkCandidate } from './internalLinks'

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
  /** Reads a global (header, footer). Optional so tests can pass a collections-only engine. */
  findGlobal?(args: { slug: string; depth?: number }): Promise<unknown>
}

type NavLink = { page?: unknown; customUrl?: unknown; linkType?: unknown }
const asArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object') : []

/** Every link the header menu, its children, the announcement bar and the footer columns make. */
function navLinksOf(header: Record<string, unknown> | null, footer: Record<string, unknown> | null): NavLink[] {
  const out: NavLink[] = []
  for (const item of asArray(header?.menu)) {
    out.push(item as NavLink)
    out.push(...(asArray(item.children) as NavLink[]))
  }
  const bar = (header?.announcementBar && typeof header.announcementBar === 'object' ? header.announcementBar : {}) as Record<string, unknown>
  if (typeof bar.linkUrl === 'string') out.push({ customUrl: bar.linkUrl, linkType: 'custom' })
  for (const column of asArray(footer?.columns)) out.push(...(asArray(column.links) as NavLink[]))
  return out
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
  const addLinks = (key: string, targets: Iterable<string>) => {
    const own = new Set(targets)
    linksOut.set(key, own)
    for (const target of own) linkedFrom.set(target, new Set([...(linkedFrom.get(target) ?? []), key]))
  }
  for (const collection of AUDIT_COLLECTIONS) {
    for (const doc of docsOf.get(collection) ?? []) addLinks(`${collection}-${String(doc.id)}`, internalTargetsOf(doc))
  }
  // Menus, header and footer count as linking documents too, so a page only in the menu is not an orphan.
  const globalOf = async (slug: string): Promise<Record<string, unknown> | null> => {
    try {
      const doc = await engine.findGlobal?.({ slug, depth: 0 })
      return doc && typeof doc === 'object' ? (doc as Record<string, unknown>) : null
    } catch {
      return null
    }
  }
  const header = await globalOf('header')
  const footer = await globalOf('footer')
  const navTargets = new Set<string>()
  for (const link of navLinksOf(header, footer)) {
    const page = link.page !== undefined && link.page !== null && link.page !== '' ? pagesById.get(String(typeof link.page === 'object' && link.page ? (link.page as { id?: unknown }).id : link.page)) : undefined
    const path = page ? pathOf.get(String(page.id)) ?? null : typeof link.customUrl === 'string' ? internalPathOf(link.customUrl) : null
    if (path) navTargets.add(path)
  }
  addLinks('navigation', navTargets)

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
