import type { SectionNode } from '@/lib/sectionTree'

import { getList, getNode, type NodePath } from './treeOps'

/**
 * Undo/redo for the page tree. Pure: the editor keeps one History value and replaces it with
 * the result of each call. A snapshot holds the whole tree (the tree is immutable, so this is
 * just a reference per entry) plus the selection that was active when it was taken.
 */
export type Snapshot = {
  blocks: SectionNode[]
  selectedPath: NodePath | null
  /**
   * Name of the action that follows this state ("Added Heading"). On a redo entry it is the action
   * that leads to the state instead, so undo and redo hand the same name back and forth.
   */
  label?: string
}

export type History = {
  past: Snapshot[]
  future: Snapshot[]
  /** Coalescing key of the most recent push, and when it happened. */
  lastKey: string | null
  lastAt: number
}

export const HISTORY_LIMIT = 100
export const COALESCE_MS = 800

export const createHistory = (): History => ({ past: [], future: [], lastKey: null, lastAt: 0 })

export const canUndo = (h: History): boolean => h.past.length > 0
export const canRedo = (h: History): boolean => h.future.length > 0

/**
 * Records `before` (the state a mutation is about to replace). Redo is cleared. When `key` is
 * given and equals the previous push's key within COALESCE_MS, no new entry is made: the
 * earlier entry already holds the state from before the burst of edits.
 */
export function pushHistory(h: History, before: Snapshot, options: { key?: string; now?: number; label?: string } = {}): History {
  const now = options.now ?? Date.now()
  const key = options.key ?? null
  if (key !== null && key === h.lastKey && now - h.lastAt < COALESCE_MS && h.past.length > 0) {
    return { ...h, future: [], lastAt: now }
  }
  const past = [...h.past, options.label ? { ...before, label: options.label } : before]
  if (past.length > HISTORY_LIMIT) past.splice(0, past.length - HISTORY_LIMIT)
  return { past, future: [], lastKey: key, lastAt: now }
}

/** Steps back. `current` is what is on screen now (it becomes the redo entry). Null when empty. */
export function undoHistory(h: History, current: Snapshot): { history: History; snapshot: Snapshot } | null {
  if (h.past.length === 0) return null
  const snapshot = h.past[h.past.length - 1]
  return {
    snapshot,
    history: {
      past: h.past.slice(0, -1),
      future: [...h.future, snapshot.label ? { ...current, label: snapshot.label } : current],
      lastKey: null,
      lastAt: 0,
    },
  }
}

export function redoHistory(h: History, current: Snapshot): { history: History; snapshot: Snapshot } | null {
  if (h.future.length === 0) return null
  const snapshot = h.future[h.future.length - 1]
  return {
    snapshot,
    history: {
      past: [...h.past, snapshot.label ? { ...current, label: snapshot.label } : current],
      future: h.future.slice(0, -1),
      lastKey: null,
      lastAt: 0,
    },
  }
}

/**
 * Jumps `steps` entries: negative undoes that many times, positive redoes. `current` is what is on screen.
 * Null when `steps` is 0 or more than the history holds.
 */
export function jumpHistory(h: History, current: Snapshot, steps: number): { history: History; snapshot: Snapshot } | null {
  if (!Number.isInteger(steps) || steps === 0) return null
  const count = Math.abs(steps)
  if (count > (steps < 0 ? h.past.length : h.future.length)) return null
  let history = h
  let snapshot = current
  for (let i = 0; i < count; i += 1) {
    const result = steps < 0 ? undoHistory(history, snapshot) : redoHistory(history, snapshot)
    if (!result) return null
    history = result.history
    snapshot = result.snapshot
  }
  return { history, snapshot }
}

/** One line of the History panel. `steps` is what to pass to jumpHistory to land on it (0 = the current state). */
export type HistoryRow = { id: string; label: string | null; steps: number }

/**
 * The rows the History panel shows, oldest first: the starting state (label null), then the state after
 * each action, the current one (steps 0) and the states that redo would reach.
 */
export function historyRows(h: History): HistoryRow[] {
  const rows: HistoryRow[] = []
  const total = h.past.length
  if (total > 0) rows.push({ id: 'past-0', label: null, steps: -total })
  for (let i = 1; i <= total; i += 1) {
    rows.push({ id: i === total ? 'current' : `past-${i}`, label: h.past[i - 1].label ?? null, steps: i - total })
  }
  if (total === 0) rows.push({ id: 'current', label: null, steps: 0 })
  for (let i = h.future.length - 1, step = 1; i >= 0; i -= 1, step += 1) {
    rows.push({ id: `future-${step}`, label: h.future[i].label ?? null, steps: step })
  }
  return rows
}

/**
 * Keeps a selection valid against a tree: the path itself when it still resolves, else the
 * nearest sibling in the same list, else the parent, else null.
 */
export function clampPath(blocks: SectionNode[], path: NodePath | null): NodePath | null {
  if (!path || path.length === 0) return null
  let current: NodePath = path
  while (current.length > 0) {
    if (current.length % 2 === 1) {
      if (getNode(blocks, current)) return current
      const container = current.slice(0, -1)
      const list = getList(blocks, container)
      if (list && list.length > 0) return [...container, Math.min(current[current.length - 1], list.length - 1)]
      current = container.slice(0, -1)
    } else {
      const owner = getNode(blocks, current.slice(0, -1))
      if (owner?.columns?.[current[current.length - 1]]) return current
      current = current.slice(0, -1)
    }
  }
  return null
}
