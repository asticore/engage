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

/** Overflow menu for the top bar: a button that opens a short list of actions. Closes on pick, outside click and Escape. */
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
      <button type="button" className="ve-btn ve-btn--ghost" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {t('ve.top.more')} {String.fromCodePoint(0x25be)}
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
