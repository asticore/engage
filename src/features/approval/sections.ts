import type { ApprovalCollection } from './settings'

/**
 * Sections for per-section approvers. Pages and posts have no section field of their own, so a section is derived:
 * - a page's section is the top-level page it sits under (the page itself when it has no parent), keyed by that page's id;
 * - a post's section is its first category, trimmed and lower-cased.
 * Events, courses and products have none, so a section route never applies to them.
 */

type EngineLike = {
  findByID: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>
  find: (args: Record<string, unknown>) => Promise<{ docs: Array<Record<string, unknown>> }>
}

const MAX_DEPTH = 12

const idOf = (value: unknown): number | null => {
  const raw = typeof value === 'object' && value !== null ? (value as { id?: unknown }).id : value
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

export const normaliseSection = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const clean = value.trim().toLowerCase()
  return clean ? clean : null
}

/** The section of one document, or null when it has none. A failed read gives null (no section route applies). */
export async function sectionKeyOf(engine: EngineLike, collection: ApprovalCollection | string, doc: Record<string, unknown>): Promise<string | null> {
  try {
    if (collection === 'posts') {
      const first = Array.isArray(doc.categories) ? (doc.categories[0] as { name?: unknown } | undefined) : undefined
      return normaliseSection(first?.name)
    }
    if (collection === 'pages') {
      let current: Record<string, unknown> | null = doc
      for (let depth = 0; depth < MAX_DEPTH && current; depth++) {
        const parentId = idOf(current.parent)
        if (parentId === null) return idOf(current.id) === null ? null : String(idOf(current.id))
        current = await engine.findByID({ collection: 'pages', id: parentId, depth: 0, overrideAccess: true })
      }
    }
  } catch {
    // no section
  }
  return null
}

export type SectionChoice = { key: string; label: string }

/** The sections the editor can route: top-level pages, and the distinct post categories. Best effort; a failed read gives none. */
export async function loadSectionChoices(engine: EngineLike): Promise<Record<'pages' | 'posts', SectionChoice[]>> {
  const out: Record<'pages' | 'posts', SectionChoice[]> = { pages: [], posts: [] }
  try {
    const { docs } = await engine.find({ collection: 'pages', where: { parent: { exists: false } }, limit: 200, depth: 0, sort: 'title', overrideAccess: true })
    for (const page of docs) {
      const id = idOf(page.id)
      if (id !== null) out.pages.push({ key: String(id), label: typeof page.title === 'string' && page.title.trim() ? page.title.trim() : `Page ${id}` })
    }
  } catch {
    // none
  }
  try {
    const { docs } = await engine.find({ collection: 'posts', limit: 1000, depth: 0, overrideAccess: true })
    const seen = new Map<string, string>()
    for (const post of docs) {
      const first = Array.isArray(post.categories) ? (post.categories[0] as { name?: unknown } | undefined) : undefined
      const key = normaliseSection(first?.name)
      if (key && !seen.has(key)) seen.set(key, String(first?.name).trim())
    }
    out.posts = [...seen.entries()].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label))
  } catch {
    // none
  }
  return out
}
