'use client'

import React from 'react'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import { ADMIN_TOUR_START_EVENT } from '@/features/adminTour/steps'

/** Sidebar "Help" button: replays the admin tour at any time. Reuses the Log out button's look. */
export const TourHelpButton: React.FC = () => {
  const t = useAdminT()
  return (
    <button
      aria-label={t('tour.replay')}
      className="nav__log-out nav__help"
      onClick={() => window.dispatchEvent(new CustomEvent(ADMIN_TOUR_START_EVENT))}
      type="button"
    >
      <svg aria-hidden="true" height="15" viewBox="0 0 16 16" width="15">
        <circle cx="8" cy="8" fill="none" r="6.5" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M6.2 6.3a1.9 1.9 0 1 1 2.7 1.7c-.6.3-.9.7-.9 1.3M8 11.6v.1"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.4"
        />
      </svg>
      <span>{t('tour.help')}</span>
    </button>
  )
}

export default TourHelpButton
