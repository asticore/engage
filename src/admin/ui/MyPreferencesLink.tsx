'use client'

import React from 'react'

import { AdminLink } from '@/admin/adminRoute/AdminLink'
import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import { Tooltip } from '@/components/admin/shared/Tooltip'

/** Route (under the admin root) of the signed-in person's own preferences page. */
export const MY_PREFERENCES_PATH = '/settings/my-preferences'

/** Sidebar bottom link to My preferences (language, theme, tour). Shows the person's name when known. */
export const MyPreferencesLink: React.FC<{ name?: string | null }> = ({ name }) => {
  const t = useAdminT()
  const label = t('nav.myPreferences')
  return (
    <Tooltip text={name ? `${label} (${name})` : label}>
      <AdminLink aria-label={label} className="nav__log-out nav__prefs" id="nav-my-preferences" path={MY_PREFERENCES_PATH} prefetch={false}>
        <svg aria-hidden="true" height="15" viewBox="0 0 16 16" width="15">
          <circle cx="8" cy="5.5" fill="none" r="2.8" stroke="currentColor" strokeWidth="1.4" />
          <path d="M2.5 14c.4-2.7 2.7-4.3 5.5-4.3s5.1 1.6 5.5 4.3" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
        </svg>
        <span>{name || label}</span>
      </AdminLink>
    </Tooltip>
  )
}

export default MyPreferencesLink
