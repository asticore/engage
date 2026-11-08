'use client'

import { useEffect, useState } from 'react'

import { parseRevisions, type RevisionRow } from './revisions'

export type RevisionsState = {
  /** `loading` until the first answer; `unavailable` when the collection has no versions (404). */
  status: 'loading' | 'ready' | 'unavailable' | 'error'
  rows: RevisionRow[]
  error: string | null
  /** When the list was last loaded (ms); relative times in the panel are measured from it. */
  fetchedAt: number
}

/**
 * Loads the document's saved revisions once `enabled` (the History tab was opened) and again whenever
 * `refreshKey` changes (after a save). The previous list stays on screen while it reloads.
 */
export function useRevisions(url: string | null, blocksField: string, enabled: boolean, refreshKey: number): RevisionsState {
  const [state, setState] = useState<RevisionsState>({ status: 'loading', rows: [], error: null, fetchedAt: 0 })

  useEffect(() => {
    if (!enabled || !url) return
    let cancelled = false
    fetch(url, { credentials: 'include' })
      .then(async (response) => {
        if (response.status === 404) {
          if (!cancelled) setState({ status: 'unavailable', rows: [], error: null, fetchedAt: Date.now() })
          return
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const rows = parseRevisions(await response.json(), blocksField)
        if (!cancelled) setState({ status: 'ready', rows, error: null, fetchedAt: Date.now() })
      })
      .catch((err: unknown) => {
        if (!cancelled) setState((prev) => ({ status: 'error', rows: prev.rows, error: err instanceof Error ? err.message : 'Failed to load revisions', fetchedAt: prev.fetchedAt }))
      })
    return () => {
      cancelled = true
    }
  }, [url, blocksField, enabled, refreshKey])

  return state
}
