import { slugify } from '@/utilities/formatSlug'

/**
 * Nested categories (Task 7): pure tree helpers. Rows come from `eg_categories` (see store.ts). A row with no
 * parent is a top level category; a category can sit under another one, up to MAX_DEPTH levels. Slugs are unique
 * per scope ('shop' or 'blog'), so a category is reached by its own slug alone; the full path (parent/child) is
 * also accepted and checked, so nested URLs and flat URLs both work.
 */

export const CATEGORY_SCOPES = ['shop', 'blog'] as const
export type CategoryScope = (typeof CATEGORY_SCOPES)[number]
export const MAX_DEPTH = 6

export type CategoryRow = { id: number; scope: string; name: string; slug: string; parentId: number | null; sortOrder: number }
export type CategoryNode = CategoryRow & { depth: number; children: CategoryNode[] }

export const isScope = (value: unknown): value is CategoryScope => typeof value === 'string' && (CATEGORY_SCOPES as readonly string[]).includes(value)

const byOrder = (a: CategoryRow, b: CategoryRow): number => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id - b.id

/** Children of `parentId` (null = top level), in display order. A parent that is missing counts as top level. */
export function childrenOf(rows: CategoryRow[], parentId: number | null): CategoryRow[] {
  const ids = new Set(rows.map((r) => r.id))
  return rows.filter((r) => (parentId === null ? r.parentId === null || !ids.has(r.parentId) : r.parentId === parentId)).sort(byOrder)
}

/** The whole forest as nested nodes. A cycle in bad data is cut so every row appears once. */
export function buildTree(rows: CategoryRow[]): CategoryNode[] {
  const seen = new Set<number>()
  const build = (parentId: number | null, depth: number): CategoryNode[] => {
    const out: CategoryNode[] = []
    for (const row of childrenOf(rows, parentId)) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      out.push({ ...row, depth, children: build(row.id, depth + 1) })
    }
    return out
  }
  return build(null, 0)
}

/** The tree flattened in display order (parents before their children), each with its depth. */
export function flattenTree(rows: CategoryRow[]): CategoryNode[] {
  const out: CategoryNode[] = []
  const walk = (nodes: CategoryNode[]) => {
    for (const node of nodes) {
      out.push(node)
      walk(node.children)
    }
  }
  walk(buildTree(rows))
  return out
}

/** The category and every category below it. */
export function descendantIds(rows: CategoryRow[], id: number): number[] {
  const out = [id]
  for (let i = 0; i < out.length; i++) for (const row of rows) if (row.parentId === out[i] && !out.includes(row.id)) out.push(row.id)
  return out
}

/** From the top level down to the category itself. Empty when the id is unknown. */
export function ancestorsOf(rows: CategoryRow[], id: number): CategoryRow[] {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const chain: CategoryRow[] = []
  let cursor = byId.get(id)
  while (cursor && !chain.includes(cursor)) {
    chain.unshift(cursor)
    cursor = cursor.parentId === null ? undefined : byId.get(cursor.parentId)
  }
  return chain
}

export const depthOf = (rows: CategoryRow[], id: number): number => Math.max(ancestorsOf(rows, id).length - 1, 0)

/** Levels below the category (0 for a leaf). */
export function subtreeHeight(rows: CategoryRow[], id: number): number {
  const kids = rows.filter((r) => r.parentId === id)
  return kids.length === 0 ? 0 : 1 + Math.max(...kids.map((k) => subtreeHeight(rows, k.id)))
}

/** Why `id` cannot go under `parentId` (null = top level), or null when the move is fine. */
export function moveProblem(rows: CategoryRow[], id: number, parentId: number | null): 'missing' | 'cycle' | 'too-deep' | null {
  if (!rows.some((r) => r.id === id)) return 'missing'
  if (parentId === null) return null
  if (!rows.some((r) => r.id === parentId)) return 'missing'
  if (descendantIds(rows, id).includes(parentId)) return 'cycle'
  if (depthOf(rows, parentId) + 1 + subtreeHeight(rows, id) >= MAX_DEPTH) return 'too-deep'
  return null
}

/** Slug segments from the top level down, for a nested URL (/shop/category/clothing/shirts). */
export const pathSlugs = (rows: CategoryRow[], id: number): string[] => ancestorsOf(rows, id).map((r) => r.slug)

export const findBySlug = (rows: CategoryRow[], slug: string): CategoryRow | null => rows.find((r) => r.slug === slug) ?? null

/**
 * The category named by URL segments. The last segment names it; any earlier segments must be its ancestors in
 * order, so a wrong path is a miss (404). A single segment always works, which keeps flat links alive.
 */
export function resolvePath(rows: CategoryRow[], segments: string[]): CategoryRow | null {
  const clean = segments.filter(Boolean)
  const leaf = clean.length ? findBySlug(rows, clean[clean.length - 1]) : null
  if (!leaf) return null
  if (clean.length === 1) return leaf
  const chain = pathSlugs(rows, leaf.id)
  return clean.length <= chain.length && clean.every((s, i) => s === chain[chain.length - clean.length + i]) ? leaf : null
}

/** A slug for `name` that no other category in the scope uses (adds -2, -3 ...). */
export function uniqueSlug(rows: CategoryRow[], name: string, excludeId?: number): string {
  const base = slugify(name) || 'category'
  const taken = new Set(rows.filter((r) => r.id !== excludeId).map((r) => r.slug))
  let slug = base
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`
  return slug
}

/** Names of the category and everything below it: what a blog post's category list is matched against. */
export function subtreeNames(rows: CategoryRow[], id: number): string[] {
  const ids = new Set(descendantIds(rows, id))
  return rows.filter((r) => ids.has(r.id)).map((r) => r.name)
}

/** Display path such as "Clothing > Shirts". */
export const pathLabel = (rows: CategoryRow[], id: number): string => ancestorsOf(rows, id).map((r) => r.name).join(' > ')
