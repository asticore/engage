'use client'

import React, { useEffect, useState } from 'react'

/**
 * Dismissible alert and toast. Wraps the alert markup: a close button hides it, a toast sits in a window
 * corner and can close itself after a number of seconds. Reduced motion skips the fade. Without JS the
 * alert simply shows inline and cannot be closed.
 */
export const AlertDismiss: React.FC<{
  className: string
  role: 'alert' | 'note' | 'status'
  toast?: boolean
  autoCloseSeconds?: number
  closeLabel?: string
  children: React.ReactNode
}> = ({ className, role, toast, autoCloseSeconds, closeLabel, children }) => {
  const [open, setOpen] = useState(true)
  useEffect(() => {
    if (!autoCloseSeconds) return
    const id = window.setTimeout(() => setOpen(false), autoCloseSeconds * 1000)
    return () => window.clearTimeout(id)
  }, [autoCloseSeconds])
  if (!open) return null
  return (
    <div className={`${className}${toast ? ' el-alert--toast' : ''} el-alert--dismissible`} role={toast && role === 'note' ? 'status' : role}>
      {children}
      <button type="button" className="el-alert__close" aria-label={closeLabel || 'Dismiss'} onClick={() => setOpen(false)}>
        <span aria-hidden="true">×</span>
      </button>
    </div>
  )
}
