import { loadLibraryManifest } from './loader'
import { readLibraryState, type LibraryStoreEngine } from './store'
import type { LibraryItem, LibraryItemRow, LibrarySummary } from './types'

/** The path of a library item's preview picture, served through the library routes (never a GitHub URL). */
export function previewPathFor(libraryId: string, slug: string, variant?: 'dark'): string {
  return `/api/template-libraries/preview?library=${encodeURIComponent(libraryId)}&item=${encodeURIComponent(slug)}${variant ? `&variant=${variant}` : ''}`
}

export type LibraryListing = { libraries: LibrarySummary[]; items: LibraryItemRow[] }

/**
 * Every enabled library with its manifest, plus the combined item list the hub and the visual editor show.
 * One library failing never hides the others: its error is reported on its own row.
 */
export async function listLibraries(engine: LibraryStoreEngine, options: { fresh?: boolean } = {}): Promise<LibraryListing> {
  const state = await readLibraryState(engine)
  const deps = options.fresh ? { bypassCache: true } : {}
  const loaded = await Promise.all(
    state.rows.map(async (row) => (row.enabled && row.config ? loadLibraryManifest(row.config, deps, state.token) : null)),
  )

  const libraries: LibrarySummary[] = []
  const items: LibraryItemRow[] = []
  state.rows.forEach((row, index) => {
    const summary: LibrarySummary = { id: row.id, label: row.label, url: row.url, enabled: row.enabled, name: null, itemCount: 0, languages: ['en'], error: row.error, builtIn: row.builtIn === true }
    const result = loaded[index]
    if (result && result.ok) {
      summary.name = result.value.name
      summary.itemCount = result.value.items.length
      summary.languages = result.value.languages
      for (const item of result.value.items as LibraryItem[]) {
        items.push({
          key: `${row.id}:${item.slug}`,
          libraryId: row.id,
          libraryLabel: row.label,
          slug: item.slug,
          title: item.title,
          kind: item.kind,
          category: item.category,
          tags: item.tags,
          previewUrl: previewPathFor(row.id, item.slug),
          type: item.type ?? item.kind,
          industry: item.industry ?? '',
          style: item.style ?? '',
          theme: item.theme ?? 'both',
          pairWith: item.pairWith ?? '',
          siteKind: item.siteKind ?? '',
          previewDarkUrl: item.previewDark ? previewPathFor(row.id, item.slug, 'dark') : '',
        })
      }
    } else if (result && !result.ok) {
      summary.error = result.error
    }
    libraries.push(summary)
  })
  return { libraries, items }
}

/**
 * Picks the light or dark twin of an item. When the item has a `pairWith` partner and is written for the other theme,
 * the partner (if it is for the preferred theme) is used instead. Items marked `both`, or with no partner, are kept.
 */
export function pickThemeVariant(items: LibraryItem[], item: LibraryItem, prefer: 'light' | 'dark' | ''): LibraryItem {
  if (!prefer || !item.pairWith || !item.theme || item.theme === 'both' || item.theme === prefer) return item
  const partner = items.find((candidate) => candidate.slug === item.pairWith)
  return partner && partner.theme === prefer ? partner : item
}

/** Finds a saved library row and one of its manifest items. Both are looked up by the saved id and the item slug. */
export async function findLibraryItem(
  engine: LibraryStoreEngine,
  libraryId: string,
): Promise<{ ok: true; row: Awaited<ReturnType<typeof readLibraryState>>['rows'][number]; manifestItems: LibraryItem[]; token: string | null; error?: undefined; status?: undefined } | { ok: false; error: string; status: number; row?: undefined; manifestItems?: undefined }> {
  const state = await readLibraryState(engine)
  const row = state.rows.find((candidate) => candidate.id === libraryId)
  if (!row || !row.enabled || !row.config) return { ok: false, error: 'That library is not available.', status: 404 }
  const manifest = await loadLibraryManifest(row.config, {}, state.token)
  if (!manifest.ok) return { ok: false, error: manifest.error, status: 502 }
  return { ok: true, row, manifestItems: manifest.value.items, token: state.token }
}
