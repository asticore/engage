'use client'

/**
 * Mobile (<= 768px) top menu bar: the site name and a hamburger that opens and
 * closes the nav drawer. Hidden on desktop by CSS, where the collapse button
 * lives inside the sidebar instead. The visual editor hides it (veShell.css).
 */

import React from 'react'
import { useNav } from '@/admin/context'
import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import { Hamburger } from '@/admin/ui/Hamburger'

export const AdminTopBar: React.FC<{ siteName: string }> = ({ siteName }) => {
  const { navOpen, toggleSidebar } = useNav()
  const t = useAdminT()
  const label = navOpen ? t('nav.closeMenu') : t('nav.openMenu')

  return (
    <header className="admin-topbar">
      <span className="admin-topbar__name">{siteName}</span>
      <button
        aria-controls="admin-nav"
        aria-expanded={navOpen}
        aria-label={label}
        className="admin-topbar__menu"
        onClick={toggleSidebar}
        suppressHydrationWarning
        type="button"
      >
        <Hamburger isActive={navOpen} suppressHydrationWarning />
      </button>
    </header>
  )
}

export default AdminTopBar
