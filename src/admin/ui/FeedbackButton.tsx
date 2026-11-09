'use client'

import React, { useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'

import { buildFeedbackUrl, type FeedbackKind } from './feedbackUrl'
import { useFocusTrap } from './useFocusTrap'

/**
 * Sidebar "Feedback" button, super admins only (the admin role is the highest there is; the
 * parent decides who sees it). Opens a popup to pick Bug or Feature request, then opens the
 * matching new issue page of the repo, pre-filled with version, page and language.
 */
export const FeedbackButton: React.FC<{ version: string }> = ({ version }) => {
  const t = useAdminT()
  const pathname = usePathname() ?? ''
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, open)

  const choose = (kind: FeedbackKind) => {
    const url = buildFeedbackUrl({
      kind,
      version,
      path: pathname,
      language: document.documentElement.lang || undefined,
    })
    window.open(url, '_blank', 'noopener,noreferrer')
    setOpen(false)
  }

  return (
    <>
      <button
        aria-haspopup="dialog"
        aria-label={t('feedback.open')}
        className="nav__log-out nav__help"
        onClick={() => setOpen(true)}
        type="button"
      >
        <svg aria-hidden="true" height="15" viewBox="0 0 16 16" width="15">
          <path d="M2 3.5h12v7H8.5L5 13.5v-3H2z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.4" />
        </svg>
        <span>{t('feedback.button')}</span>
      </button>
      {open ? (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
          }}
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10060,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            aria-labelledby="feedback-dialog-title"
            aria-modal="true"
            ref={dialogRef}
            role="dialog"
            style={{
              background: 'var(--theme-elevation-0, #fff)',
              color: 'var(--theme-text, #111)',
              borderRadius: 8,
              padding: 20,
              width: 'min(360px, 92vw)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
            tabIndex={-1}
          >
            <h2 id="feedback-dialog-title" style={{ margin: 0, fontSize: 18 }}>
              {t('feedback.title')}
            </h2>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>{t('feedback.hint')}</p>
            <button className="btn btn--style-primary" data-autofocus onClick={() => choose('bug')} type="button">
              {t('feedback.bug')}
            </button>
            <button className="btn btn--style-secondary" onClick={() => choose('feature')} type="button">
              {t('feedback.feature')}
            </button>
            <button className="btn btn--style-secondary" onClick={() => setOpen(false)} type="button">
              {t('feedback.cancel')}
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default FeedbackButton
