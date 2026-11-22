/**
 * Bulk create: turn pasted titles or a CSV into a plan of new draft pages, posts or products, flagging problems before
 * anything is written. Pure: no I/O, so the preview and the real run use the same rules.
 */
import { parseCsv } from '@/lib/spreadsheet/csv'
import { cleanSlug } from '@/features/importContent/items'

export const BULK_CREATE_COLLECTIONS = ['pages', 'posts', 'products'] as const
export type BulkCreateCollection = (typeof BULK_CREATE_COLLECTIONS)[number]
export const BULK_CREATE_MAX_ROWS = 200

export type BulkInputRow = { ref: string; title: string; slug: string; parent: string; template: string }

export type BulkDefaults = { parent?: string; template?: string; status?: 'draft' | 'published'; locale?: string }

/** Fills a row's empty parent and template from the choices made above the list (pages only). A row's own value wins. */
export function applyBulkDefaults(rows: BulkInputRow[], defaults: BulkDefaults): BulkInputRow[] {
  const parent = (defaults.parent ?? '').trim()
  const template = (defaults.template ?? '').trim()
  if (!parent && !template) return rows
  return rows.map((r) => ({ ...r, parent: r.parent.trim() || parent, template: r.template.trim() || template }))
}

export type ParsedInput = { rows: BulkInputRow[]; errors: string[] }

const HEADERS = ['title', 'slug', 'parent', 'template']

/**
 * One title per line, or a CSV whose first row names its columns (title, slug, parent, template). A first line that
 * contains a "title" cell is read as a header. Anything else is treated as plain titles.
 */
export function parseBulkInput(text: string): ParsedInput {
  const errors: string[] = []
  const trimmed = text.replace(/^﻿/, '').trim()
  if (!trimmed) return { rows: [], errors: ['Paste some titles or upload a CSV first.'] }
  const firstLine = trimmed.split(/\r?\n/, 1)[0].toLowerCase()
  const hasHeader = /(^|[,;\t])\s*title\s*([,;\t]|$)/.test(firstLine)
  const rows: BulkInputRow[] = []
  if (hasHeader) {
    const parsed = parseCsv(trimmed, { maxRows: BULK_CREATE_MAX_ROWS + 2 })
    if (parsed.truncated) return { rows: [], errors: [`One batch handles at most ${BULK_CREATE_MAX_ROWS} rows. Split the file and create the parts one at a time.`] }
    const [header, ...body] = parsed.rows
    const columns = header.map((c) => c.trim().toLowerCase().replace(/[\s-]+/g, '_'))
    const at = (name: string): number => columns.indexOf(name)
    const unknown = columns.filter((c) => c && !HEADERS.includes(c))
    if (unknown.length) errors.push(`These columns are not used and were ignored: ${unknown.join(', ')}.`)
    body.forEach((cells, i) => {
      const cell = (name: string): string => (at(name) === -1 ? '' : (cells[at(name)] ?? '').trim())
      if (cells.every((c) => !c.trim())) return
      rows.push({ ref: `row ${i + 2}`, title: cell('title'), slug: cell('slug'), parent: cell('parent'), template: cell('template') })
    })
  } else {
    trimmed.split(/\r?\n/).forEach((line, i) => {
      if (!line.trim()) return
      rows.push({ ref: `line ${i + 1}`, title: line.trim(), slug: '', parent: '', template: '' })
    })
  }
  if (rows.length > BULK_CREATE_MAX_ROWS) return { rows: [], errors: [`One batch handles at most ${BULK_CREATE_MAX_ROWS} rows. Split the list and create the parts one at a time.`] }
  return { rows, errors }
}

export type ExistingDocs = {
  /** Slugs already used in the collection. */
  slugs: Set<string>
  /** Existing pages by slug, for parents. */
  pageIds: Map<string, number>
  /** Existing titles (products need unique titles), lower case. */
  titles: Set<string>
  /** Page templates by lower-case title and by id, for the template column. */
  templates: Map<string, number>
}

export type PlannedRow = {
  ref: string
  title: string
  slug: string
  /** The slug of a parent created in this same batch, or '' */
  batchParent: string
  /** An existing parent page id, or null. */
  parentId: number | null
  templateId: number | null
  ok: boolean
  problems: string[]
}

export const emptyExisting = (): ExistingDocs => ({ slugs: new Set(), pageIds: new Map(), titles: new Set(), templates: new Map() })

export function planBulk(collection: BulkCreateCollection, rows: BulkInputRow[], existing: ExistingDocs): PlannedRow[] {
  const batchSlugs = new Map<string, number>()
  const batchTitles = new Set<string>()
  const planned: PlannedRow[] = rows.map((row) => {
    const problems: string[] = []
    const slug = cleanSlug(row.slug || row.title)
    if (!row.title.trim()) problems.push('No title.')
    else if (!slug) problems.push('The title has no letters or digits to make an address from.')
    if (slug && existing.slugs.has(slug)) problems.push(`The address "${slug}" is already used.`)
    if (slug && batchSlugs.has(slug)) problems.push(`The address "${slug}" is used again in this list (first at row ${batchSlugs.get(slug)! + 1}).`)
    if (slug && !batchSlugs.has(slug)) batchSlugs.set(slug, batchSlugs.size)
    if (collection === 'products') {
      const key = row.title.trim().toLowerCase()
      if (key && (existing.titles.has(key) || batchTitles.has(key))) problems.push('A product with this title already exists. Product titles must be unique.')
      batchTitles.add(key)
    }
    let parentId: number | null = null
    let batchParent = ''
    if (collection === 'pages' && row.parent.trim()) {
      const parentSlug = cleanSlug(row.parent)
      const inBatch = rows.some((r) => cleanSlug(r.slug || r.title) === parentSlug)
      if (parentSlug === slug) problems.push('A page cannot be its own parent.')
      else if (existing.pageIds.has(parentSlug)) parentId = existing.pageIds.get(parentSlug)!
      else if (inBatch) batchParent = parentSlug
      else problems.push(`The parent page "${row.parent.trim()}" was not found.`)
    }
    let templateId: number | null = null
    if (collection === 'pages' && row.template.trim()) {
      templateId = existing.templates.get(row.template.trim().toLowerCase()) ?? null
      if (templateId === null) problems.push(`The template "${row.template.trim()}" was not found.`)
    }
    return { ref: row.ref, title: row.title.trim(), slug, batchParent, parentId, templateId, ok: problems.length === 0, problems }
  })
  // A parent in the batch that itself has a problem would leave its children without a parent.
  const okSlugs = new Set(planned.filter((p) => p.ok).map((p) => p.slug))
  for (const p of planned) {
    if (p.ok && p.batchParent && !okSlugs.has(p.batchParent)) {
      p.ok = false
      p.problems.push(`The parent "${p.batchParent}" in this list has a problem, so it would not be created.`)
    }
  }
  return planned
}

/** Rows ordered so every parent comes before its children. Rows with cycles are left out (they are flagged by `cycleRefs`). */
export function creationOrder(planned: PlannedRow[]): PlannedRow[] {
  const ordered: PlannedRow[] = []
  const done = new Set<string>()
  let remaining = planned.filter((p) => p.ok)
  while (remaining.length) {
    const ready = remaining.filter((p) => !p.batchParent || done.has(p.batchParent))
    if (ready.length === 0) break
    for (const p of ready) {
      ordered.push(p)
      done.add(p.slug)
    }
    remaining = remaining.filter((p) => !ready.includes(p))
  }
  return ordered
}

/** Rows that could not be ordered because their parents point at each other. */
export const cycleRefs = (planned: PlannedRow[]): string[] => {
  const ordered = new Set(creationOrder(planned).map((p) => p.ref))
  return planned.filter((p) => p.ok && !ordered.has(p.ref)).map((p) => p.ref)
}
