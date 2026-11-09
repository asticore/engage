'use client'

/**
 * The desktop sidebar's collapse/expand button. It lives INSIDE the sidebar,
 * in the brand row at the top of the nav (AdminNav.tsx), so it never overhangs
 * the page content. On mobile the drawer is opened and closed from the top
 * bar instead (AdminTopBar.tsx), so this button is hidden there by CSS.
 *
 * Keeps the `nav-toggler` class: the visual editor hides admin shell chrome by
 * that name (veShell.css).
 */

import React from 'react'
import { useNav } from '@/admin/context'
import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import { Tooltip } from '@/components/admin/shared/Tooltip'

const PanelIcon: React.FC = () => (
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" width="16">
    <rect fill="none" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" width="12" x="2" y="2" />
    <line stroke="currentColor" strokeWidth="1.4" x1="6.3" x2="6.3" y1="2" y2="14" />
  </svg>
)

export const NavToggler: React.FC = () => {
  const { collapsed, toggleSidebar } = useNav()
  const t = useAdminT()

  const label = collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')

  return (
    <Tooltip text={`${label} (Ctrl/⌘+B)`}>
      <button
        aria-label={label}
        className="nav-toggler"
        onClick={toggleSidebar}
        suppressHydrationWarning
        type="button"
      >
        <PanelIcon />
      </button>
    </Tooltip>
  )
}

export default NavToggler
