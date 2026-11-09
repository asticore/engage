'use client'

import React, { useState } from 'react'

import { CLEAR_CONFIRM_WORD } from '@/features/security/activityQuery'

type Mode = 'older' | 'person' | 'all'

/**
 * Clear panel for the activity log. Shows how many entries a clear would remove
 * before anything is deleted, offers the CSV download first, and needs the word
 * CLEAR typed. Consent, privacy and earlier clear records stay either way.
 */
export function ActivityClearPanel({ exportHref, defaultPerson }: { exportHref: string; defaultPerson: string }) {
  const [mode, setMode] = useState<Mode>('older')
  const [days, setDays] = useState('90')
  const [person, setPerson] = useState(defaultPerson)
  const [confirm, setConfirm] = useState('')
  const [count, setCount] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const scopeBody = (): Record<string, unknown> => (mode === 'older' ? { mode, days: Number(days) } : mode === 'person' ? { mode, person } : { mode })

  async function send(extra: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/admin-activity-log', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...scopeBody(), ...extra }) })
      const data = (await response.json()) as Record<string, unknown>
      if (!response.ok) {
        setMessage(typeof data.error === 'string' ? data.error : 'Request failed')
        return null
      }
      return data
    } catch {
      setMessage('Request failed')
      return null
    } finally {
      setBusy(false)
    }
  }

  return (
    <details style={{ margin: '1.5rem 0', border: '1px solid #c8c8c8', borderRadius: 6, padding: '0.75rem 1rem' }}>
      <summary>Clear activity log</summary>
      <p>Removes entries from the log and records who cleared it and how many. Consent decisions, privacy request records and earlier clear records are always kept. The retention period on the Security screen already removes old entries on its own.</p>
      <p><a href={exportHref} download>Download the current view as CSV first</a></p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>What to clear</span>
          <select value={mode} onChange={(event) => { setMode(event.target.value as Mode); setCount(null) }}>
            <option value="older">Entries older than a number of days</option>
            <option value="person">All entries for one person</option>
            <option value="all">All entries</option>
          </select>
        </label>
        {mode === 'older' ? (
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Days</span>
            <input type="number" min={1} max={3650} value={days} onChange={(event) => { setDays(event.target.value); setCount(null) }} />
          </label>
        ) : null}
        {mode === 'person' ? (
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Email or ID</span>
            <input type="text" maxLength={255} value={person} onChange={(event) => { setPerson(event.target.value); setCount(null) }} />
          </label>
        ) : null}
        <button type="button" disabled={busy} onClick={async () => { const data = await send({ dryRun: true }); if (data) setCount(Number(data.count)) }}>Count entries</button>
      </div>
      {count !== null ? (
        <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
          <p style={{ margin: 0 }}>{count} entries would be removed.</p>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Type {CLEAR_CONFIRM_WORD} to confirm</span>
            <input type="text" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="off" />
          </label>
          <button
            type="button"
            disabled={busy || confirm !== CLEAR_CONFIRM_WORD || count === 0}
            onClick={async () => {
              const data = await send({ confirm })
              if (data) {
                setMessage(`Cleared ${String(data.cleared)} entries. Reloading.`)
                window.location.reload()
              }
            }}
          >
            Clear now
          </button>
        </div>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </details>
  )
}
