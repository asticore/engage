import type { NodePath } from './treeOps'
import { filterQuickInsert } from './quickInsert'

/**
 * Pure helpers for the Finder (Mod+E): one searchable list of the page's nodes, editor commands and
 * other pages. Ranking reuses the quick insert palette's filterQuickInsert, so both behave alike.
 */

export type FinderCommandId =
  | 'save'
  | 'publish'
  | 'pageSettings'
  | 'navigator'
  | 'history'
  | 'desktop'
  | 'tablet'
  | 'mobile'
  | 'importExport'
  | 'shortcuts'

export type FinderEntry =
  | { kind: 'node'; id: string; label: string; hint: string; icon: string; path: NodePath }
  | { kind: 'command'; id: string; label: string; hint: string; icon: string; command: FinderCommandId }
  | { kind: 'page'; id: string; label: string; hint: string; icon: string; pageId: string }

/** A flattened navigator row (see NavigatorPanel.flattenNavigatorNames). */
export type FinderNode = { path: NodePath; name: string; typeLabel: string; icon: string }

export function nodeEntries(nodes: readonly FinderNode[]): FinderEntry[] {
  return nodes.map((n) => ({ kind: 'node', id: `node:${n.path.join('.')}`, label: n.name, hint: n.typeLabel, icon: n.icon, path: n.path }))
}

export function commandEntries(commands: readonly { command: FinderCommandId; label: string; hint: string }[]): FinderEntry[] {
  return commands.map((c) => ({ kind: 'command', id: `command:${c.command}`, label: c.label, hint: c.hint, icon: '>', command: c.command }))
}

export function pageEntries(pages: readonly { id: string | number; title: string }[], hint: string, currentId?: string): FinderEntry[] {
  return pages
    .filter((p) => String(p.id) !== currentId)
    .map((p) => ({ kind: 'page', id: `page:${String(p.id)}`, label: p.title || `#${String(p.id)}`, hint, icon: '#', pageId: String(p.id) }))
}

/** Ranks entries for `query` (filterQuickInsert's rules over label, then hint). Empty query keeps the given order. */
export function filterFinder(entries: readonly FinderEntry[], query: string, limit = 12): FinderEntry[] {
  const cards = entries.map((e) => ({ slug: e.id, label: e.label, description: e.hint, entry: e }))
  return filterQuickInsert(cards, query, [], limit).map((c) => c.entry)
}

/** Pages search request (title contains the query). Payload's `like` is case-insensitive. */
export function pagesSearchUrl(query: string): string {
  const q = query.trim()
  return `/api/pages?limit=20&depth=0${q ? `&where[title][like]=${encodeURIComponent(q)}` : ''}`
}

/** Admin editor address of another page (`adminRoot` is the admin base, e.g. "/admin"). */
export function pageEditorHref(adminRoot: string, id: string | number): string {
  return `${adminRoot}/visual-editor/collection/pages/${encodeURIComponent(String(id))}`
}

/** Pulls {id, title} rows out of a Payload list response, ignoring anything malformed. */
export function parsePagesResponse(body: unknown): { id: string | number; title: string }[] {
  const docs = (body as { docs?: unknown } | null)?.docs
  if (!Array.isArray(docs)) return []
  const out: { id: string | number; title: string }[] = []
  for (const d of docs) {
    const doc = d as { id?: unknown; title?: unknown }
    if (typeof doc?.id !== 'string' && typeof doc?.id !== 'number') continue
    out.push({ id: doc.id, title: typeof doc.title === 'string' ? doc.title : '' })
  }
  return out
}
