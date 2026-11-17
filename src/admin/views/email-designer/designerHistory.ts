/**
 * Undo and redo for one email's draft in the Email designer. Pure: a list of earlier drafts and a list of undone ones.
 * Typing coalesces: edits that land within `COALESCE_MS` of each other count as one step, so Undo goes back a burst of
 * typing, not a letter. A new edit after an undo clears what could have been redone.
 */
export type History<T> = { past: T[]; future: T[]; at: number }

export const HISTORY_LIMIT = 50
export const COALESCE_MS = 800

export const emptyHistory = <T>(): History<T> => ({ past: [], future: [], at: 0 })

/** Records `previous` as the state to return to before an edit made at time `now`. */
export function recordEdit<T>(history: History<T>, previous: T, now: number): History<T> {
  const burst = history.past.length > 0 && now - history.at < COALESCE_MS && history.future.length === 0
  const past = burst ? history.past : [...history.past, previous].slice(-HISTORY_LIMIT)
  return { past, future: [], at: now }
}

export function undo<T>(history: History<T>, current: T): { history: History<T>; value: T } | null {
  if (history.past.length === 0) return null
  const value = history.past[history.past.length - 1]
  return { value, history: { past: history.past.slice(0, -1), future: [current, ...history.future], at: 0 } }
}

export function redo<T>(history: History<T>, current: T): { history: History<T>; value: T } | null {
  if (history.future.length === 0) return null
  const [value, ...rest] = history.future
  return { value, history: { past: [...history.past, current].slice(-HISTORY_LIMIT), future: rest, at: 0 } }
}
