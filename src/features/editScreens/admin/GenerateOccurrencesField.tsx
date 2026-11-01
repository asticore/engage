'use client'

import React, { useState } from 'react'

import { useDocumentInfo } from '@/engine/ui'
import { Tooltip } from '@/components/admin/shared/Tooltip'
import { useAdminT } from '@/admin/i18n/AdminUiProvider'

type GenerateResult = { ok?: boolean; created?: number; skipped?: number; failed?: number; truncated?: boolean; error?: string }

/**
 * Under Repeats on an event. "Generate occurrences" creates the other dates of the series as
 * drafts. The event must be saved first, because the server reads the saved repeat rule.
 */
export function GenerateOccurrencesField() {
  const t = useAdminT()
  const { id } = useDocumentInfo()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const run = async (): Promise<void> => {
    if (id === undefined || id === null || id === '') {
      setMessage('Save the event first, then generate the dates.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch(`/api/admin-event-generate?id=${encodeURIComponent(String(id))}`, {
        method: 'POST',
        credentials: 'include',
      })
      const body = (await res.json().catch((): null => null)) as GenerateResult | null
      if (!res.ok || !body?.ok) {
        setMessage(body?.error || 'The dates could not be created. Try again.')
        return
      }
      const failed = body.failed ? ` ${body.failed} could not be saved.` : ''
      const limit = body.truncated ? ' Stopped at the limit of 52 dates.' : ''
      setMessage(`${body.created ?? 0} date(s) created as drafts, ${body.skipped ?? 0} already there.${failed}${limit}`)
    } catch {
      setMessage('The dates could not be created. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="field-type" style={{ marginBottom: 16 }}>
      <Tooltip text={t('tip.createsADraftEventFor')}><button type="button" className="btn btn--secondary" disabled={busy} onClick={run}>
        {busy ? 'Creating dates...' : 'Generate occurrences'}
      </button></Tooltip>
      {message ? (
        <p role="status" style={{ marginTop: 8 }}>
          {message}
        </p>
      ) : null}
    </div>
  )
}
