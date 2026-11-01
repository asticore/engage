'use client'

import React, { useState, useSyncExternalStore } from 'react'
import { AdminLink } from '@/admin/adminRoute/AdminLink'
import { POLICY_REVIEW_STORAGE_KEY, POLICY_REVIEW_TEXT } from './policyReview'

/**
 * Dashboard notice. The server decides whether the policy page still needs a look (policyReview.ts);
 * the dismissal lives in this browser only, so a notice dismissed on one device shows again on another.
 * Every storage access is wrapped: a blocked or private window just shows the notice.
 */
const subscribe = () => () => {}

/** Reads the dismissal; a blocked storage reads as not dismissed. Server render shows nothing, so no flash. */
const readDismissed = (): boolean => {
  try {
    return window.localStorage.getItem(POLICY_REVIEW_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function PolicyReviewNotice({ visible }: { visible: boolean }) {
  const storedDismissed = useSyncExternalStore(subscribe, readDismissed, () => true)
  const [justDismissed, setJustDismissed] = useState(false)
  const dismissed = storedDismissed || justDismissed

  if (!visible || dismissed) return null

  const dismiss = () => {
    try {
      window.localStorage.setItem(POLICY_REVIEW_STORAGE_KEY, '1')
    } catch {
      // Without storage the notice comes back on the next visit; nothing else to do.
    }
    setJustDismissed(true)
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-[var(--base)] rounded-[4px] border border-[var(--theme-elevation-200)] px-[calc(var(--base)*0.8)] py-[calc(var(--base)*0.6)] text-[calc(var(--base)*0.85)]"
    >
      <span>
        {POLICY_REVIEW_TEXT}.{' '}
        <AdminLink href="/settings/site" className="text-[var(--ac-gold)]">
          Open General settings
        </AdminLink>
      </span>
      <button
        type="button"
        onClick={dismiss}
        className="rounded-[4px] border border-[var(--theme-elevation-200)] bg-transparent px-[calc(var(--base)*0.6)] py-[calc(var(--base)*0.3)] text-[calc(var(--base)*0.8)]"
      >
        Dismiss
      </button>
    </div>
  )
}
