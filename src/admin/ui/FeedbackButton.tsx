'use client'

import React from 'react'
import { usePathname } from 'next/navigation'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'

import { buildFeedbackUrl } from './feedbackUrl'

/**
 * Sidebar "Feedback" button, super admins only (the admin role is the highest there is; the
 * parent decides who sees it). Opens the repo's new issue page, pre-filled with version and page.
 */
export const FeedbackButton: React.FC<{ version: string }> = ({ version }) => {
  const t = useAdminT()
  const pathname = usePathname() ?? ''
  return (
    <button
      aria-label={t('feedback.open')}
      className="nav__log-out nav__help"
      onClick={() => {
        const url = buildFeedbackUrl({ version, path: pathname, language: document.documentElement.lang || undefined })
        window.open(url, '_blank', 'noopener,noreferrer')
      }}
      type="button"
    >
      <svg aria-hidden="true" height="15" viewBox="0 0 16 16" width="15">
        <path d="M2 3.5h12v7H8.5L5 13.5v-3H2z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.4" />
      </svg>
      <span>{t('feedback.button')}</span>
    </button>
  )
}

export default FeedbackButton
