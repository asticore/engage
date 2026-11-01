/**
 * The public path of a page from its slug and its parent chain. Kept in its own
 * module with no imports, so collection hooks can use it without pulling in the
 * SEO analysis code.
 */

/** Deepest parent chain walked when building a page path (same ceiling as the page tree). */
const MAX_PARENT_DEPTH = 8

/**
 * The public path of a page from its slug and its parent chain, root first.
 * `lookup` returns a page by id from the same read, or undefined.
 */
export function pagePathOf(doc: Record<string, unknown>, lookup: (id: string) => Record<string, unknown> | undefined): string | null {
  if (doc.isHomepage === true) return '/'
  const segments: string[] = []
  let current: Record<string, unknown> | undefined = doc
  for (let depth = 0; current && depth < MAX_PARENT_DEPTH; depth += 1) {
    if (typeof current.slug !== 'string' || current.slug === '') return null
    segments.unshift(current.slug)
    const parent = current.parent
    const parentId = parent && typeof parent === 'object' ? (parent as { id?: unknown }).id : parent
    if (parentId === undefined || parentId === null || parentId === '') break
    current = lookup(String(parentId))
  }
  return `/${segments.join('/')}`
}
