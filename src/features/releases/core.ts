/**
 * Releases (Task 15, 34h6): a named bundle of pages, posts, events, courses and products that go live together, now
 * or at a set time, and can be undone. Pure rules, no storage, unit tested.
 */

export const RELEASE_COLLECTIONS = ['pages', 'posts', 'events', 'courses', 'products'] as const
export type ReleaseCollection = (typeof RELEASE_COLLECTIONS)[number]
export const MAX_ITEMS = 200

export type ReleaseItem = { collection: ReleaseCollection; docId: number; before: 'draft' | 'published' | null }
export type ReleaseStatus = 'open' | 'published' | 'undone'

export const cleanCollection = (v: unknown): ReleaseCollection | null => (RELEASE_COLLECTIONS as readonly string[]).includes(String(v)) ? (v as ReleaseCollection) : null
export const cleanDocId = (v: unknown): number | null => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null)

export const cleanName = (v: unknown): string => String(v ?? '').trim().slice(0, 100)

/** An ISO time in the future or past; anything unparseable (or empty) means no schedule. */
export const cleanWhen = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return null
  const t = new Date(s).getTime()
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

/** Open releases whose time has come, soonest first. */
export const dueReleases = <T extends { status: ReleaseStatus; publishAt: string | null }>(rows: T[], nowIso: string): T[] =>
  rows.filter((r) => r.status === 'open' && r.publishAt !== null && r.publishAt <= nowIso).sort((a, b) => String(a.publishAt).localeCompare(String(b.publishAt)))

/** What undo does to one item: documents that were already live before the release stay live; the rest go back to draft. */
export const undoTarget = (item: Pick<ReleaseItem, 'before'>): 'draft' | 'published' => (item.before === 'published' ? 'published' : 'draft')
