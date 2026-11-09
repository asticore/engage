'use client'

/**
 * Light/dark switch for the sidebar's bottom controls (next to Help and Log
 * out). One click flips to the opposite of what is showing now; the full
 * light/dark/system choice is on the My preferences page. See ThemeContext.tsx
 * for where the preference itself lives. Icon-only (with tooltip) when the
 * sidebar is collapsed to its rail.
 *
 * Keeps the `theme-toggler` class: the visual editor hides admin shell chrome
 * by that name (veShell.css).
 */

import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import React, { useSyncExternalStore } from 'react'
import { useTheme } from '@/admin/context/ThemeContext'
import { Tooltip } from '@/components/admin/shared/Tooltip'

const SunIcon: React.FC = () => (
  <svg aria-hidden="true" fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" viewBox="0 0 16 16" width="15">
    <circle cx="8" cy="8" r="2.6" />
    <path d="M8 1.6v1.6M8 12.8v1.6M14.4 8h-1.6M3.2 8H1.6M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1M12.4 12.4l-1.1-1.1M4.7 4.7 3.6 3.6" />
  </svg>
)

const MoonIcon: React.FC = () => (
  <svg aria-hidden="true" fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" viewBox="0 0 16 16" width="15">
    <path d="M13.8 9.8A6 6 0 0 1 6.2 2.2a6 6 0 1 0 7.6 7.6Z" />
  </svg>
)

const DARK_QUERY = '(prefers-color-scheme: dark)'

function subscribeSystemDark(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(DARK_QUERY)
  query.addEventListener?.('change', onChange)
  return () => query.removeEventListener?.('change', onChange)
}

const systemDarkNow = (): boolean => typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches

export const ThemeToggler: React.FC = () => {
  const t = useAdminT()
  const { setTheme, theme } = useTheme()
  // The server render assumes a light device; the client corrects it after hydration.
  const systemDark = useSyncExternalStore(subscribeSystemDark, systemDarkNow, () => false)

  const isDark = theme === 'dark' || (theme === 'auto' && systemDark)
  const label = isDark ? t('nav.themeToLight') : t('nav.themeToDark')

  return (
    <Tooltip text={label}>
      <button
        aria-label={label}
        className="nav__log-out theme-toggler"
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        suppressHydrationWarning
        type="button"
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
        <span>{label}</span>
      </button>
    </Tooltip>
  )
}

export default ThemeToggler
