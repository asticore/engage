'use client'

import React, { useState } from 'react'
import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import './csv-export.css'

/**
 * The list's Export CSV button. It downloads the export in place rather than as a plain link, so
 * the button can say it is working while the rows are read, and the page can say when the export
 * stopped at the row cap (the server sets `X-Export-Truncated: 1` then).
 */

type ExportState = { status: 'idle' } | { status: 'exporting' } | { status: 'done'; truncated: boolean } | { status: 'error' }

/** The file name from a `Content-Disposition: attachment; filename="..."` header, or the fallback. */
export function filenameFromDisposition(header: string | null, fallback: string): string {
  const match = header ? /filename="([^"]+)"/.exec(header) : null
  return match ? match[1] : fallback
}

export function CsvExportButton({ href, label, title, className, maxRows, fallbackName = 'export.csv' }: {
  href: string
  label: string
  title?: string
  className?: string
  /** The row cap the server applies, shown in the truncation message. */
  maxRows: number
  fallbackName?: string
}) {
  const t = useAdminT()
  const [state, setState] = useState<ExportState>({ status: 'idle' })
  const exporting = state.status === 'exporting'

  const run = async () => {
    if (exporting) return
    setState({ status: 'exporting' })
    try {
      const response = await fetch(href, { credentials: 'include' })
      if (!response.ok) throw new Error(`Export failed with ${response.status}`)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filenameFromDisposition(response.headers.get('Content-Disposition'), fallbackName)
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      // Give the browser time to start the download before the object URL is released.
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      setState({ status: 'done', truncated: response.headers.get('X-Export-Truncated') === '1' })
    } catch {
      setState({ status: 'error' })
    }
  }

  const message =
    state.status === 'error' ? t('list.exportFailed') : state.status === 'done' && state.truncated ? t('list.exportTruncated', { count: maxRows }) : ''

  return (
    <>
      <button type="button" onClick={run} disabled={exporting} aria-busy={exporting} className={className} title={title}>
        {exporting ? t('list.exporting') : label}
      </button>
      <span role="status" className="csv-export__message">
        {message}
      </span>
    </>
  )
}
