'use client'

import React, { useCallback, useState } from 'react'

type Delivery = { entry: number; webhookId: string; name: string; host: string; attempt: number; at: string; ok: boolean; status?: number; error?: string }

const post = async (body: Record<string, unknown>): Promise<{ ok?: boolean; status?: number; error?: string }> => {
  const response = await fetch('/api/admin-form-webhooks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return (await response.json().catch((): Record<string, never> => ({}))) as { ok?: boolean; status?: number; error?: string }
}

/** "Send test" for one saved webhook. Sends a made-up entry (event form.test); the address and secret used are the saved ones. */
export const WebhookTestButton: React.FC<{ formId: string | undefined; webhookId: string | undefined }> = ({ formId, webhookId }) => {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  if (!formId || !webhookId) return null
  return (
    <div>
      <button
        type="button"
        className="ve-btn ve-btn--ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          const result = await post({ action: 'test', form: Number(formId), webhookId }).catch((): { ok?: boolean; status?: number; error?: string } => ({ error: 'Could not reach the server.' }))
          setMessage(result.ok ? `The receiver accepted the test (HTTP ${result.status}).` : result.error || 'The test failed.')
          setBusy(false)
        }}
      >
        Send test
      </button>
      {message ? (
        <p className="ve-panel__hint" role="status">
          {message}
        </p>
      ) : null}
    </div>
  )
}

/** Recent deliveries across this form's entries with the status code, and a Re-send button per delivery. */
export const WebhookDeliveryLog: React.FC<{ formId: string | undefined }> = ({ formId }) => {
  const [rows, setRows] = useState<Delivery[] | null>(null)
  const [message, setMessage] = useState('')
  const load = useCallback(async () => {
    if (!formId) return
    const response = await fetch(`/api/admin-form-webhooks?form=${encodeURIComponent(formId)}`)
    const data = (await response.json().catch((): Record<string, never> => ({}))) as { deliveries?: Delivery[]; error?: string }
    if (data.deliveries) setRows(data.deliveries)
    else setMessage(data.error || 'Could not load the delivery log.')
  }, [formId])
  if (!formId) return null
  return (
    <div className="ve-form-card">
      <button type="button" className="ve-btn ve-btn--ghost" onClick={() => void load()}>
        {rows ? 'Refresh delivery log' : 'Show delivery log'}
      </button>
      {message ? <p className="ve-panel__hint">{message}</p> : null}
      <p className="ve-panel__hint">
        <a href="/api/admin-form-webhooks?docs=1" target="_blank" rel="noreferrer">
          Recipes for Zapier, Make and the data API
        </a>
      </p>
      {rows && rows.length === 0 ? <p className="ve-panel__hint">No deliveries yet.</p> : null}
      {rows && rows.length > 0 ? (
        <table style={{ width: '100%', fontSize: 12 }}>
          <thead>
            <tr>
              <th align="left">Entry</th>
              <th align="left">Webhook</th>
              <th align="left">Try</th>
              <th align="left">Result</th>
              <th align="left">When</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.entry}-${row.webhookId}-${row.attempt}-${index}`}>
                <td>#{row.entry}</td>
                <td title={row.host}>{row.name}</td>
                <td>{row.attempt}</td>
                <td>{row.ok ? `OK (${row.status})` : `${row.status ?? 'Failed'}: ${row.error || ''}`}</td>
                <td>{new Date(row.at).toLocaleString()}</td>
                <td>
                  <button
                    type="button"
                    className="ve-btn ve-btn--ghost"
                    onClick={async () => {
                      const result = await post({ action: 'resend', entry: row.entry, webhookId: row.webhookId }).catch((): { ok?: boolean; status?: number; error?: string } => ({ error: 'Could not reach the server.' }))
                      setMessage(result.ok ? `Entry #${row.entry} sent again.` : result.error || 'Re-send failed.')
                      await load()
                    }}
                  >
                    Re-send
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  )
}
