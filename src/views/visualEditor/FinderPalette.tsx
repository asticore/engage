'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'

import { filterFinder, pageEntries, pagesSearchUrl, parsePagesResponse, type FinderEntry } from './finder'
import { moveHighlight } from './quickInsert'

/**
 * Finder (Mod+E): jump to a node on this page, run an editor command, or open another page. Styled like
 * the "/" quick insert palette. Arrows move, Enter picks, Esc closes. Other pages are looked up on the
 * server (debounced) as the query changes.
 */
export const FinderPalette: React.FC<{
  /** Nodes and commands (the pages come from the server). */
  entries: FinderEntry[]
  /** The page being edited, left out of the page results. */
  currentId?: string
  onPick: (entry: FinderEntry) => void
  onClose: () => void
}> = ({ entries, currentId, onPick, onClose }) => {
  const t = useAdminT()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [pages, setPages] = useState<FinderEntry[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetch(pagesSearchUrl(q), { credentials: 'include', signal: controller.signal })
        .then((r): Promise<unknown> => (r.ok ? r.json() : Promise.resolve(null)))
        .then((body) => setPages(pageEntries(parsePagesResponse(body), t('ve.finder.page'), currentId)))
        .catch((): void => undefined)
    }, 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, currentId, t])

  const results = useMemo(
    () => [...filterFinder(entries, query, 12), ...(query.trim().length >= 2 ? pages : [])],
    [entries, query, pages],
  )
  const current = Math.min(active, Math.max(results.length - 1, 0))

  return (
    <div
      role="dialog"
      aria-label={t('ve.finder.title')}
      className="ve-quick-insert ve-finder"
      style={{ position: 'fixed', top: 72, left: '50%', transform: 'translateX(-50%)', width: 420, maxWidth: 'calc(100vw - 32px)', zIndex: 10001, background: '#fff', color: '#111', border: '1px solid #c3c4c7', borderRadius: 6, boxShadow: '0 6px 24px rgba(0,0,0,.18)', padding: 6, font: '14px/1.3 system-ui, sans-serif' }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder={t('ve.finder.placeholder')}
        aria-label={t('ve.finder.title')}
        aria-controls="ve-finder-list"
        aria-activedescendant={results[current] ? `ve-finder-${results[current].id}` : undefined}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
        }}
        onBlur={onClose}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
          } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            setActive(moveHighlight(current, e.key === 'ArrowDown' ? 1 : -1, results.length))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (results[current]) onPick(results[current])
          }
        }}
        style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', border: '1px solid #8c8f94', borderRadius: 4, font: 'inherit' }}
      />
      <ul id="ve-finder-list" role="listbox" style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, maxHeight: 320, overflowY: 'auto' }}>
        {results.length === 0 && <li style={{ padding: '6px 8px', color: '#646970' }}>{t('ve.finder.empty')}</li>}
        {results.map((entry, i) => (
          <li
            key={entry.id}
            id={`ve-finder-${entry.id}`}
            role="option"
            aria-selected={i === current}
            onMouseEnter={() => setActive(i)}
            onMouseDown={(e) => {
              e.preventDefault()
              onPick(entry)
            }}
            style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 8px', borderRadius: 4, cursor: 'pointer', background: i === current ? '#e6f0fa' : 'transparent' }}
          >
            <span aria-hidden="true">{entry.icon}</span>
            <span>{entry.label}</span>
            <small style={{ marginLeft: 'auto', color: '#646970' }}>{entry.hint}</small>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default FinderPalette
