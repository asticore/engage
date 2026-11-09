import { resolveD1Binding } from '@/cms/db/connect'

import { type CategoryRow, type CategoryScope, descendantIds, moveProblem, childrenOf, uniqueSlug } from './tree'

/**
 * Reads and writes `eg_categories` and `eg_category_links` (migration 20270313_100000_categories). Links tie a
 * document (a product id for 'shop') to a category; blog posts keep their own category names and are matched by name.
 */

export const CATEGORIES_TABLE = 'eg_categories'
export const LINKS_TABLE = 'eg_category_links'

type Raw = { id: number; scope: string; name: string; slug: string; parent_id: number | null; sort_order: number }
const toRow = (r: Raw): CategoryRow => ({ id: Number(r.id), scope: String(r.scope), name: String(r.name), slug: String(r.slug), parentId: r.parent_id === null || r.parent_id === undefined ? null : Number(r.parent_id), sortOrder: Number(r.sort_order ?? 0) })

export async function listCategories(scope: CategoryScope): Promise<CategoryRow[]> {
  const d1 = await resolveD1Binding()
  const { results } = await d1.prepare(`SELECT id, scope, name, slug, parent_id, sort_order FROM ${CATEGORIES_TABLE} WHERE scope = ? ORDER BY sort_order, name`).bind(scope).all<Raw>()
  return (results ?? []).map(toRow)
}

/** Same as listCategories but never throws: a site without the table yet simply has no nested categories. */
export const listCategoriesSafe = (scope: CategoryScope): Promise<CategoryRow[]> => listCategories(scope).catch((): CategoryRow[] => [])

export type StoreResult = { ok: true; id?: number } | { ok: false; error: 'missing' | 'cycle' | 'too-deep' | 'name' }

const now = (): string => new Date().toISOString()

/** Rewrites sort_order 0..n for the children of one parent, in the given id order. */
async function setOrder(scope: CategoryScope, ids: number[]): Promise<void> {
  const d1 = await resolveD1Binding()
  if (ids.length === 0) return
  await d1.batch(ids.map((id, index) => d1.prepare(`UPDATE ${CATEGORIES_TABLE} SET sort_order = ?, updated_at = ? WHERE id = ? AND scope = ?`).bind(index, now(), id, scope)))
}

export async function addCategory(scope: CategoryScope, name: string, parentId: number | null): Promise<StoreResult> {
  const clean = name.trim().slice(0, 120)
  if (!clean) return { ok: false, error: 'name' }
  const rows = await listCategories(scope)
  if (parentId !== null) {
    if (!rows.some((r) => r.id === parentId)) return { ok: false, error: 'missing' }
    // A new leaf must fit under the parent: reuse the move check with a stand-in row.
    const probe = [...rows, { id: -1, scope, name: clean, slug: '', parentId, sortOrder: 0 }]
    const problem = moveProblem(probe, -1, parentId)
    if (problem) return { ok: false, error: problem }
  }
  const d1 = await resolveD1Binding()
  const slug = uniqueSlug(rows, clean)
  const sort = childrenOf(rows, parentId).length
  const res = await d1.prepare(`INSERT INTO ${CATEGORIES_TABLE} (scope, name, slug, parent_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(scope, clean, slug, parentId, sort, now(), now()).run()
  return { ok: true, id: Number(res.meta?.last_row_id ?? 0) }
}

export async function renameCategory(scope: CategoryScope, id: number, name: string, slug?: string): Promise<StoreResult> {
  const clean = name.trim().slice(0, 120)
  if (!clean) return { ok: false, error: 'name' }
  const rows = await listCategories(scope)
  if (!rows.some((r) => r.id === id)) return { ok: false, error: 'missing' }
  const nextSlug = uniqueSlug(rows, slug && slug.trim() ? slug : clean, id)
  const d1 = await resolveD1Binding()
  await d1.prepare(`UPDATE ${CATEGORIES_TABLE} SET name = ?, slug = ?, updated_at = ? WHERE id = ? AND scope = ?`).bind(clean, nextSlug, now(), id, scope).run()
  return { ok: true, id }
}

/** Moves a category (with everything below it) under `parentId` (null = top level), at the end of that level. */
export async function moveCategory(scope: CategoryScope, id: number, parentId: number | null): Promise<StoreResult> {
  const rows = await listCategories(scope)
  const problem = moveProblem(rows, id, parentId)
  if (problem) return { ok: false, error: problem }
  const d1 = await resolveD1Binding()
  const end = childrenOf(rows.filter((r) => r.id !== id), parentId).length
  await d1.prepare(`UPDATE ${CATEGORIES_TABLE} SET parent_id = ?, sort_order = ?, updated_at = ? WHERE id = ? AND scope = ?`).bind(parentId, end, now(), id, scope).run()
  const old = rows.find((r) => r.id === id)?.parentId ?? null
  if (old !== parentId) await setOrder(scope, childrenOf(rows.filter((r) => r.id !== id), old).map((r) => r.id))
  return { ok: true, id }
}

/** Moves a category one place up or down among its siblings. */
export async function reorderCategory(scope: CategoryScope, id: number, direction: 'up' | 'down'): Promise<StoreResult> {
  const rows = await listCategories(scope)
  const row = rows.find((r) => r.id === id)
  if (!row) return { ok: false, error: 'missing' }
  const ids = childrenOf(rows, row.parentId).map((r) => r.id)
  const at = ids.indexOf(id)
  const to = direction === 'up' ? at - 1 : at + 1
  if (at >= 0 && to >= 0 && to < ids.length) {
    ;[ids[at], ids[to]] = [ids[to], ids[at]]
  }
  await setOrder(scope, ids)
  return { ok: true, id }
}

/** Deletes a category. Its children move up to its parent; its links are removed. Documents are never touched. */
export async function deleteCategory(scope: CategoryScope, id: number): Promise<StoreResult> {
  const rows = await listCategories(scope)
  const row = rows.find((r) => r.id === id)
  if (!row) return { ok: false, error: 'missing' }
  const d1 = await resolveD1Binding()
  await d1.batch([
    d1.prepare(`UPDATE ${CATEGORIES_TABLE} SET parent_id = ?, updated_at = ? WHERE parent_id = ? AND scope = ?`).bind(row.parentId, now(), id, scope),
    d1.prepare(`DELETE FROM ${LINKS_TABLE} WHERE category_id = ?`).bind(id),
    d1.prepare(`DELETE FROM ${CATEGORIES_TABLE} WHERE id = ? AND scope = ?`).bind(id, scope),
  ])
  await setOrder(scope, childrenOf((await listCategories(scope)), row.parentId).map((r) => r.id))
  return { ok: true, id }
}

/** Replaces the documents linked to a category. */
export async function setCategoryLinks(scope: CategoryScope, categoryId: number, docIds: number[]): Promise<StoreResult> {
  const rows = await listCategories(scope)
  if (!rows.some((r) => r.id === categoryId)) return { ok: false, error: 'missing' }
  const d1 = await resolveD1Binding()
  const unique = [...new Set(docIds.filter((n) => Number.isInteger(n) && n > 0))].slice(0, 5000)
  await d1.batch([
    d1.prepare(`DELETE FROM ${LINKS_TABLE} WHERE category_id = ?`).bind(categoryId),
    ...unique.map((docId) => d1.prepare(`INSERT OR IGNORE INTO ${LINKS_TABLE} (category_id, scope, doc_id) VALUES (?, ?, ?)`).bind(categoryId, scope, docId)),
  ])
  return { ok: true, id: categoryId }
}

export async function linkedDocIds(categoryIds: number[]): Promise<number[]> {
  if (categoryIds.length === 0) return []
  const d1 = await resolveD1Binding()
  const marks = categoryIds.map(() => '?').join(',')
  const { results } = await d1.prepare(`SELECT DISTINCT doc_id FROM ${LINKS_TABLE} WHERE category_id IN (${marks})`).bind(...categoryIds).all<{ doc_id: number }>()
  return (results ?? []).map((r) => Number(r.doc_id))
}

/** Product ids in a category and all its sub categories, or null when the slug is not a nested category. */
export async function docIdsForSlug(scope: CategoryScope, slug: string): Promise<number[] | null> {
  const rows = await listCategoriesSafe(scope)
  const row = rows.find((r) => r.slug === slug)
  if (!row) return null
  return linkedDocIds(descendantIds(rows, row.id)).catch((): number[] => [])
}

/** Category ids a document is linked to. */
export async function categoryIdsOfDoc(scope: CategoryScope, docId: number): Promise<number[]> {
  const d1 = await resolveD1Binding()
  const { results } = await d1.prepare(`SELECT category_id FROM ${LINKS_TABLE} WHERE scope = ? AND doc_id = ?`).bind(scope, docId).all<{ category_id: number }>()
  return (results ?? []).map((r) => Number(r.category_id))
}
