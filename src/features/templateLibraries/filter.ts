import type { LibraryItemRow, LibraryKind } from './types'

/**
 * The Library tab's filter: a text search plus three choices (library, kind, category). Pure, so the
 * hub and its tests use the same rules. Choices are always picked from lists, never typed.
 */
export type LibraryItemFilter = {
  query: string
  /** A saved library id, or '' for every library. */
  libraryId: string
  /** 'page' or 'section', or '' for both. */
  kind: LibraryKind | ''
  /** One category name exactly as the manifest lists it, or '' for every category. */
  category: string
}

export const EMPTY_LIBRARY_FILTER: LibraryItemFilter = { query: '', libraryId: '', kind: '', category: '' }

/** Categories of the items, once each, in the order a person reads them (A to Z, case-insensitive). */
export function libraryCategories(items: LibraryItemRow[]): string[] {
  const seen = new Map<string, string>()
  for (const item of items) {
    const key = item.category.toLowerCase()
    if (!seen.has(key)) seen.set(key, item.category)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
}

/** True when the item passes every part of the filter. The search looks at title, slug, category, library and tags. */
export function matchesLibraryItem(item: LibraryItemRow, filter: LibraryItemFilter): boolean {
  if (filter.libraryId && item.libraryId !== filter.libraryId) return false
  if (filter.kind && item.kind !== filter.kind) return false
  if (filter.category && item.category.toLowerCase() !== filter.category.toLowerCase()) return false
  const needle = filter.query.trim().toLowerCase()
  if (!needle) return true
  return [item.title, item.slug, item.category, item.libraryLabel, ...item.tags].some((value) => value.toLowerCase().includes(needle))
}

export function filterLibraryItems(items: LibraryItemRow[], filter: LibraryItemFilter): LibraryItemRow[] {
  return items.filter((item) => matchesLibraryItem(item, filter))
}

/** True when any part of the filter is set. */
export function isLibraryFilterActive(filter: LibraryItemFilter): boolean {
  return filter.query.trim() !== '' || filter.libraryId !== '' || filter.kind !== '' || filter.category !== ''
}
