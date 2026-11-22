/**
 * The site audit table (item 16o): turns stored crawl rows into table rows, with the columns, filters, sorting and
 * CSV export. Pure, shared by the admin screen and its tests.
 */

import { titlePixelWidth, ISSUE_BY_ID } from './issues'
import type { PageRow } from './store'
import { SNIPPET_BY_ID } from '../snippets'

export type Indexability = { indexable: boolean; reason: string }

/** Whether search engines may index the page, and the reason when not. */
export function indexabilityOf(row: PageRow): Indexability {
  const code = row.statusCode ?? 0
  if (row.redirectHops > 0 || (code >= 300 && code < 400)) return { indexable: false, reason: 'Redirects elsewhere' }
  if (code >= 400) return { indexable: false, reason: `Error ${code}` }
  if (/noindex/.test(row.data?.robots ?? '')) return { indexable: false, reason: 'noindex' }
  const canonical = row.data?.canonical
  if (canonical) {
    const clean = canonical.replace(/^https?:\/\/[^/]+/i, '').replace(/\/$/, '') || '/'
    const own = row.path.replace(/\/$/, '') || '/'
    if (clean !== own) return { indexable: false, reason: 'Canonical points elsewhere' }
  }
  if (row.issues.includes('status-5xx')) return { indexable: false, reason: 'Server error' }
  return { indexable: true, reason: '' }
}

export type ColumnDef = { id: string; label: string; numeric?: boolean; defaultOn?: boolean; value: (row: PageRow) => string | number | null }

const COLLECTION_LABEL: Record<string, string> = { pages: 'Page', posts: 'Post', products: 'Product', events: 'Event' }

const count = (list: unknown[] | undefined): number => (list ? list.length : 0)

export const COLUMNS: readonly ColumnDef[] = [
  { id: 'path', label: 'Address', defaultOn: true, value: (r) => r.path },
  { id: 'type', label: 'Type', defaultOn: true, value: (r) => (r.collection ? (COLLECTION_LABEL[r.collection] ?? r.collection) : 'Other') },
  { id: 'status', label: 'Status code', numeric: true, defaultOn: true, value: (r) => r.statusCode },
  { id: 'indexable', label: 'Indexable', defaultOn: true, value: (r) => (indexabilityOf(r).indexable ? 'Yes' : 'No') },
  { id: 'reason', label: 'Indexability reason', value: (r) => indexabilityOf(r).reason },
  { id: 'title', label: 'Title', defaultOn: true, value: (r) => r.data?.title ?? '' },
  { id: 'titleLen', label: 'Title length', numeric: true, value: (r) => (r.data ? r.data.title.length : null) },
  { id: 'titlePx', label: 'Title width (px)', numeric: true, value: (r) => (r.data ? titlePixelWidth(r.data.title) : null) },
  { id: 'desc', label: 'Meta description', value: (r) => r.data?.metaDescription ?? '' },
  { id: 'descLen', label: 'Description length', numeric: true, value: (r) => (r.data ? (r.data.metaDescription ?? '').length : null) },
  { id: 'h1', label: 'H1', value: (r) => r.data?.headings.find((h) => h.level === 1)?.text ?? '' },
  { id: 'h1Count', label: 'H1 count', numeric: true, value: (r) => r.data?.h1Count ?? null },
  { id: 'h2Count', label: 'H2 count', numeric: true, value: (r) => r.data?.h2Count ?? null },
  { id: 'words', label: 'Word count', numeric: true, defaultOn: true, value: (r) => r.data?.wordCount ?? null },
  { id: 'reading', label: 'Reading time (min)', numeric: true, value: (r) => r.data?.readingMinutes ?? null },
  { id: 'bytes', label: 'HTML size (bytes)', numeric: true, value: (r) => r.bytes },
  { id: 'ms', label: 'Response time (ms)', numeric: true, defaultOn: true, value: (r) => r.responseMs },
  { id: 'depth', label: 'Crawl depth', numeric: true, value: (r) => r.depth },
  { id: 'inLinks', label: 'Internal links in', numeric: true, defaultOn: true, value: (r) => r.inLinks },
  { id: 'outInternal', label: 'Internal links out', numeric: true, value: (r) => r.outInternal },
  { id: 'outExternal', label: 'External links out', numeric: true, value: (r) => r.outExternal },
  { id: 'broken', label: 'Broken links', numeric: true, value: (r) => r.brokenLinks },
  { id: 'redirect', label: 'Redirect chain', value: (r) => (r.redirectHops > 0 ? `${r.redirectHops} ${r.redirectHops === 1 ? 'hop' : 'hops'} to ${r.redirectTo ?? ''}` : '') },
  { id: 'canonical', label: 'Canonical', value: (r) => r.data?.canonical ?? '' },
  { id: 'hreflang', label: 'hreflang', numeric: true, value: (r) => (r.data ? count(r.data.hreflang) : null) },
  { id: 'lang', label: 'Language', value: (r) => r.data?.lang ?? '' },
  { id: 'images', label: 'Images', numeric: true, value: (r) => r.data?.imageCount ?? null },
  { id: 'noAlt', label: 'Images missing alt', numeric: true, value: (r) => r.data?.imagesMissingAlt ?? null },
  { id: 'imageBytes', label: 'Image files total (KB)', numeric: true, value: (r) => (r.data?.imageBytes ? Math.round(r.data.imageBytes / 1024) : null) },
  { id: 'largestImage', label: 'Largest image (KB)', numeric: true, value: (r) => (r.data?.largestImageBytes ? Math.round(r.data.largestImageBytes / 1024) : null) },
  { id: 'modified', label: 'Last modified', value: (r) => (r.data?.lastModified ? r.data.lastModified.slice(0, 10) : '') },
  { id: 'schema', label: 'Structured data types', value: (r) => (r.data ? r.data.jsonLdTypes.join(', ') : '') },
  { id: 'snippets', label: 'Snippet types', value: (r) => (r.data ? r.data.snippetTypes.map((id) => SNIPPET_BY_ID[id]?.label ?? id).join(', ') : '') },
  { id: 'og', label: 'Open Graph', value: (r) => (r.data ? (r.data.ogComplete ? 'Complete' : 'Missing') : '') },
  { id: 'issues', label: 'Issues', numeric: true, defaultOn: true, value: (r) => r.issues.length },
]

/** The column ids with `id` moved to position `to` (clamped). Unknown ids leave the list as it was. */
export function moveColumn(ids: readonly string[], id: string, to: number): string[] {
  const from = ids.indexOf(id)
  if (from < 0) return [...ids]
  const next = ids.filter((x) => x !== id)
  next.splice(Math.max(0, Math.min(next.length, to)), 0, id)
  return next
}

export const DEFAULT_COLUMNS: readonly string[] = COLUMNS.filter((c) => c.defaultOn).map((c) => c.id)

export type TableFilter = { issue: string | null; search: string; type: string; severity: 'all' | 'error' | 'warning' | 'notice'; indexable: 'all' | 'yes' | 'no' }
export const EMPTY_FILTER: TableFilter = { issue: null, search: '', type: 'all', severity: 'all', indexable: 'all' }

export function filterRows(rows: PageRow[], filter: TableFilter): PageRow[] {
  const needle = filter.search.trim().toLowerCase()
  return rows.filter((row) => {
    if (row.state !== 'done') return false
    if (filter.issue && !row.issues.includes(filter.issue)) return false
    if (filter.severity !== 'all' && !row.issues.some((id) => ISSUE_BY_ID[id]?.severity === filter.severity)) return false
    if (filter.type !== 'all' && (row.collection ?? 'other') !== filter.type) return false
    if (filter.indexable !== 'all' && indexabilityOf(row).indexable !== (filter.indexable === 'yes')) return false
    if (needle && !`${row.path} ${row.data?.title ?? ''} ${row.data?.metaDescription ?? ''}`.toLowerCase().includes(needle)) return false
    return true
  })
}

export function sortRows(rows: PageRow[], columnId: string, descending: boolean): PageRow[] {
  const column = COLUMNS.find((c) => c.id === columnId)
  if (!column) return rows
  const direction = descending ? -1 : 1
  return [...rows].sort((a, b) => {
    const x = column.value(a)
    const y = column.value(b)
    if (x === null && y === null) return 0
    if (x === null) return 1
    if (y === null) return -1
    if (typeof x === 'number' && typeof y === 'number') return direction * (x - y)
    return direction * String(x).localeCompare(String(y))
  })
}

/** How many rows fail each check, most common first, for the issue cards. */
export function issueCounts(rows: PageRow[]): { id: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const row of rows) for (const id of row.issues) counts.set(id, (counts.get(id) ?? 0) + 1)
  const rank = { error: 0, warning: 1, notice: 2 }
  return [...counts.entries()]
    .map(([id, n]) => ({ id, count: n }))
    .sort((a, b) => rank[ISSUE_BY_ID[a.id]?.severity ?? 'notice'] - rank[ISSUE_BY_ID[b.id]?.severity ?? 'notice'] || b.count - a.count)
}

const csvCell = (value: string | number | null): string => {
  const text = value === null ? '' : String(value)
  // A cell that starts with = + - or @ would run as a formula in a spreadsheet, so it is prefixed.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** A CSV of the chosen columns, with the checks each page fails in a last column. */
export function toCsv(rows: PageRow[], columnIds: readonly string[]): string {
  const columns = columnIds.map((id) => COLUMNS.find((c) => c.id === id)).filter((c): c is ColumnDef => Boolean(c))
  const lines = [[...columns.map((c) => c.label), 'Checks failed'].map(csvCell).join(',')]
  for (const row of rows) lines.push([...columns.map((c) => csvCell(c.value(row))), csvCell(row.issues.map((id) => ISSUE_BY_ID[id]?.label ?? id).join('; '))].join(','))
  return lines.join('\r\n')
}

/** The change of a count since the last crawl, for the top tiles: "+3", "-2" or "no change". */
export function deltaText(current: number, previous: number | null | undefined): string {
  if (previous === null || previous === undefined) return ''
  const change = current - previous
  return change === 0 ? 'no change' : `${change > 0 ? '+' : ''}${change}`
}
