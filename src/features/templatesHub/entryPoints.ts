/**
 * Entry points from Settings and the theme page to the templates that make up blog, shop and product pages (Task 14, 33h).
 * For each kind the button opens the template in the visual builder: the one in use first, then any other, otherwise it
 * offers to create one from a starter. Pure.
 */
import type { SiteTemplateKind } from '@/features/siteTemplates/kinds'

export const ENTRY_KINDS: ReadonlyArray<{ kind: SiteTemplateKind; label: string }> = [
  { kind: 'header', label: 'Header' },
  { kind: 'footer', label: 'Footer' },
  { kind: 'archive-blog', label: 'Blog page' },
  { kind: 'single-post', label: 'Blog post' },
  { kind: 'archive-shop', label: 'Shop page' },
  { kind: 'single-product', label: 'Product page' },
  { kind: 'single-event', label: 'Event page' },
  { kind: 'search-results', label: 'Search results' },
  { kind: 'not-found', label: '404 page' },
]

export type EntryDoc = { id: number | string; kind?: string | null; enabled?: boolean | null; priority?: number | null; blocks?: unknown[] | null }
export type Entry = { kind: SiteTemplateKind; label: string; id: number | string | null; inUse: boolean }

/** One entry per kind: the template to open (in use and highest priority first), or null when the site has none. */
export function buildEntries(docs: EntryDoc[]): Entry[] {
  return ENTRY_KINDS.map(({ kind, label }) => {
    const ofKind = docs.filter((d) => d.kind === kind)
    const inUse = ofKind
      .filter((d) => d.enabled !== false && Array.isArray(d.blocks) && d.blocks.length > 0)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || Number(a.id) - Number(b.id))
    const chosen = inUse[0] ?? [...ofKind].sort((a, b) => Number(a.id) - Number(b.id))[0]
    return { kind, label, id: chosen ? chosen.id : null, inUse: inUse.length > 0 }
  })
}
