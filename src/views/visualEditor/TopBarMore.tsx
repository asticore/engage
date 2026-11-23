'use client'

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'

import './topbar.css'

/** Below this width the lower-priority top bar buttons move into the "More" menu. */
export const COMPACT_TOPBAR_QUERY = '(max-width: 1599px)'

const subscribe = (notify: () => void): (() => void) => {
  try {
    const mq = window.matchMedia(COMPACT_TOPBAR_QUERY)
    mq.addEventListener('change', notify)
    return () => mq.removeEventListener('change', notify)
  } catch {
    return () => {}
  }
}
const snapshot = (): boolean => {
  try {
    return window.matchMedia(COMPACT_TOPBAR_QUERY).matches
  } catch {
    return false
  }
}

/** True while the viewport is narrower than the full top bar needs. False on the server and without matchMedia. */
export function useCompactTopBar(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}

export type TopBarMoreItem = { key: string; label: string; onSelect: () => void; disabled?: boolean }

/** Gear menu at the right end of the top bar: a button that opens a short list of actions. Closes on pick, outside click and Escape. */
export const TopBarMore: React.FC<{ items: TopBarMoreItem[] }> = ({ items }) => {
  const t = useAdminT()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (items.length === 0) return null
  return (
    <div className="ve-more" ref={rootRef}>
      <button type="button" className="ve-btn ve-btn--ghost ve-btn--icon ve-gear" aria-haspopup="menu" aria-expanded={open} aria-label={t('ve.top.settingsMenu')} title={t('ve.top.settingsMenu')} onClick={() => setOpen((o) => !o)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
      {open && (
        <div className="ve-more__menu" role="menu">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className="ve-more__item"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
