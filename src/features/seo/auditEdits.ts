/**
 * Bulk SEO title and meta description edits from the audit list. Pure: the route
 * parses the request with these and writes the data they return.
 */

import { AUDIT_COLLECTIONS, type AuditCollection, type AuditRow } from './audit'

export const MAX_SEO_EDIT_ROWS = 100
export const SEO_TITLE_MAX = 300
export const META_DESCRIPTION_MAX = 1000

export type SeoEditRow = {
  collection: AuditCollection
  id: number
  metaTitle?: string
  metaDescription?: string
}

const isCollection = (value: unknown): value is AuditCollection => typeof value === 'string' && (AUDIT_COLLECTIONS as readonly string[]).includes(value)

/** Checks the request body. Returns the rows, or an error message for a 400. */
export function parseSeoEdits(body: unknown): { rows: SeoEditRow[] } | { error: string } {
  if (!body || typeof body !== 'object' || !Array.isArray((body as { rows?: unknown }).rows)) return { error: 'Send a list of rows.' }
  const input = (body as { rows: unknown[] }).rows
  if (input.length === 0) return { error: 'Nothing to save.' }
  if (input.length > MAX_SEO_EDIT_ROWS) return { error: `Save at most ${MAX_SEO_EDIT_ROWS} rows at a time.` }

  const rows: SeoEditRow[] = []
  for (const item of input) {
    if (!item || typeof item !== 'object') return { error: 'Each row needs a place and an id.' }
    const row = item as Record<string, unknown>
    if (!isCollection(row.collection)) return { error: 'Unknown place.' }
    const id = typeof row.id === 'number' ? row.id : Number(row.id)
    if (!Number.isInteger(id) || id <= 0) return { error: 'Each row needs a whole-number id.' }
    const edit: SeoEditRow = { collection: row.collection, id }
    if (row.metaTitle !== undefined) {
      if (typeof row.metaTitle !== 'string') return { error: 'The SEO title must be text.' }
      if (row.metaTitle.trim().length > SEO_TITLE_MAX) return { error: `The SEO title can be ${SEO_TITLE_MAX} characters at most.` }
      edit.metaTitle = row.metaTitle.trim()
    }
    if (row.metaDescription !== undefined) {
      if (typeof row.metaDescription !== 'string') return { error: 'The meta description must be text.' }
      if (row.metaDescription.trim().length > META_DESCRIPTION_MAX) return { error: `The meta description can be ${META_DESCRIPTION_MAX} characters at most.` }
      edit.metaDescription = row.metaDescription.trim()
    }
    if (edit.metaTitle === undefined && edit.metaDescription === undefined) continue
    rows.push(edit)
  }
  if (rows.length === 0) return { error: 'Nothing to save.' }
  return { rows }
}

/**
 * The `seo` group to write: the document's current group with the edited fields
 * replaced, so the other SEO settings (noindex, social image and so on) are kept.
 */
export function seoEditData(current: Record<string, unknown>, row: SeoEditRow): Record<string, unknown> {
  const seo = current.seo && typeof current.seo === 'object' ? { ...(current.seo as Record<string, unknown>) } : {}
  if (row.metaTitle !== undefined) seo.metaTitle = row.metaTitle
  if (row.metaDescription !== undefined) seo.metaDescription = row.metaDescription
  return { seo }
}

export type SeoEditField = 'metaTitle' | 'metaDescription'
/** Pending edits from the audit list, keyed by `collection-id`. */
export type SeoEditMap = Record<string, Partial<Record<SeoEditField, string>>>

export const rowKey = (row: Pick<AuditRow, 'collection' | 'id'>): string => `${row.collection}-${row.id}`

/**
 * The rows with an edit that changes something, in the shape the API takes:
 * only the fields that differ from the saved values are sent.
 */
export function changedSeoRows(rows: AuditRow[], edits: SeoEditMap): SeoEditRow[] {
  const out: SeoEditRow[] = []
  for (const row of rows) {
    const edit = edits[rowKey(row)]
    if (!edit) continue
    const change: SeoEditRow = { collection: row.collection, id: row.id as number }
    if (edit.metaTitle !== undefined && edit.metaTitle.trim() !== row.metaTitle) change.metaTitle = edit.metaTitle
    if (edit.metaDescription !== undefined && edit.metaDescription.trim() !== row.metaDescription) change.metaDescription = edit.metaDescription
    if (change.metaTitle !== undefined || change.metaDescription !== undefined) out.push(change)
  }
  return out
}
