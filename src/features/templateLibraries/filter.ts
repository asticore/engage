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
  /** Item type: page, section, shop-page, header, footer, hero or loop. '' for every type. */
  type: string
  industry: string
  style: string
  /** 'light' or 'dark' keeps items that suit it (items marked both always match). '' for any. */
  theme: '' | 'light' | 'dark'
}

export const EMPTY_LIBRARY_FILTER: LibraryItemFilter = { query: '', libraryId: '', kind: '', category: '', type: '', industry: '', style: '', theme: '' }

/** Labels of the item types, in the order the type picker lists them. */
export const LIBRARY_TYPE_LABELS: Record<string, string> = {
  page: 'Whole page',
  section: 'Section',
  'shop-page': 'Shop page',
  header: 'Header',
  footer: 'Footer',
  hero: 'Hero',
  loop: 'Loop',
  'site-template': 'Site template',
  popup: 'Popup',
}

/** Distinct non-empty values of one text field (industry or style), A to Z. */
export function libraryValues(items: LibraryItemRow[], field: 'industry' | 'style'): string[] {
  const seen = new Map<string, string>()
  for (const item of items) {
    const value = item[field]
    if (value && !seen.has(value.toLowerCase())) seen.set(value.toLowerCase(), value)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
}

/** The item types that at least one item has, in picker order. */
export function libraryTypes(items: LibraryItemRow[]): string[] {
  const present = new Set(items.map((item) => item.type))
  return Object.keys(LIBRARY_TYPE_LABELS).filter((type) => present.has(type))
}

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
  if (filter.type && item.type !== filter.type) return false
  if (filter.industry && item.industry.toLowerCase() !== filter.industry.toLowerCase()) return false
  if (filter.style && item.style.toLowerCase() !== filter.style.toLowerCase()) return false
  if (filter.theme && item.theme !== 'both' && item.theme !== filter.theme) return false
  const needle = filter.query.trim().toLowerCase()
  if (!needle) return true
  return [item.title, item.slug, item.category, item.libraryLabel, item.industry, item.style, ...item.tags].some((value) => value.toLowerCase().includes(needle))
}

export function filterLibraryItems(items: LibraryItemRow[], filter: LibraryItemFilter): LibraryItemRow[] {
  return items.filter((item) => matchesLibraryItem(item, filter))
}

/** True when any part of the filter is set. */
export function isLibraryFilterActive(filter: LibraryItemFilter): boolean {
  return filter.query.trim() !== '' || filter.libraryId !== '' || filter.kind !== '' || filter.category !== '' || filter.type !== '' || filter.industry !== '' || filter.style !== '' || filter.theme !== ''
}
