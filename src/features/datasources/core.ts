/**
 * Datasources (Task 15, 34h5): shared option lists edited once and used by many select fields. A field that names a
 * list in `datasource` gets that list's options when the form is loaded, so editing the list updates every form.
 * Pure rules, no storage: unit tested.
 */

export type DatasourceItem = { label: string; value: string }
export type Datasource = { slug: string; label: string; items: DatasourceItem[] }

export const MAX_ITEMS = 500

export const cleanSlug = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : ''
  return /^[a-z0-9][a-z0-9-]{0,47}$/.test(s) ? s : null
}

/** Lines `Label` or `Label | value` become items. The value defaults to a slug of the label; duplicates are dropped. */
export function parseItems(text: unknown): DatasourceItem[] {
  const seen = new Set<string>()
  const out: DatasourceItem[] = []
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const [l, v] = line.split('|').map((p) => p.trim())
    if (!l) continue
    const value = v || l.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || l
    if (seen.has(value)) continue
    seen.add(value)
    out.push({ label: l.slice(0, 200), value: value.slice(0, 200) })
    if (out.length >= MAX_ITEMS) break
  }
  return out
}

export const itemsToText = (items: DatasourceItem[]): string => items.map((i) => `${i.label} | ${i.value}`).join('\n')

/**
 * A copy of the value where every object with a `datasource` that names a known list has its `options` replaced by
 * that list. Walks plain objects and arrays (a form's `fields` and `layout`), leaving everything else alone. An
 * unknown list keeps the options the field already has.
 */
export function applyDatasources<T>(value: T, lists: Record<string, DatasourceItem[]>): T {
  const walk = (v: unknown, depth: number): unknown => {
    if (depth > 30 || v === null || typeof v !== 'object') return v
    if (Array.isArray(v)) return v.map((x) => walk(x, depth + 1))
    const o = v as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(o)) out[k] = walk(x, depth + 1)
    const ds = typeof o.datasource === 'string' ? lists[o.datasource] : undefined
    if (ds) out.options = ds.map((i) => ({ label: i.label, value: i.value }))
    return out
  }
  return walk(value, 0) as T
}
