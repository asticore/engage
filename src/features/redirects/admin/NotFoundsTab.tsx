'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { NotFoundTabRow } from '../notFoundAdmin'
import './not-founds-tab.css'

const REDIRECT_TYPES: { value: string; label: string }[] = [
  { value: '301', label: '301 Permanent' },
  { value: '302', label: '302 Temporary' },
  { value: '307', label: '307 Temporary (keeps method)' },
  { value: '308', label: '308 Permanent (keeps method)' },
]

const dateTime = (iso: string): string => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

/**
 * The "404s" tab on the Redirects screen. Each logged address has a target field
 * pre-filled with the suggested page; "Create redirect" makes the redirect in one
 * click and "Dismiss" drops the row without one.
 */
export function NotFoundsTab({ rows }: { rows: NotFoundTabRow[] }) {
  const router = useRouter()
  const [targets, setTargets] = useState<Record<number, string>>(() => Object.fromEntries(rows.map((row) => [row.id, row.suggestion ?? ''])))
  const [types, setTypes] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState<number | null>(null)
  const [message, setMessage] = useState<{ id: number; text: string } | null>(null)

  const send = async (id: number, body: Record<string, unknown>) => {
    setBusy(id)
    setMessage(null)
    try {
      const response = await fetch('/api/admin-not-found-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...body }),
      })
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        setMessage({ id, text: data.error ?? 'Could not save. Try again.' })
        return
      }
      router.refresh()
    } catch {
      setMessage({ id, text: 'Could not reach the server. Try again.' })
    } finally {
      setBusy(null)
    }
  }

  if (rows.length === 0) {
    return <p className="nf-empty">No 404s logged yet. Addresses that visitors cannot find appear here.</p>
  }

  return (
    <div className="nf-tab">
      <p className="nf-note">Each address is counted once a minute per server, so a burst of requests shows up as one row with its full count.</p>
      <div className="nf-table-wrap">
        <table className="nf-table">
          <thead>
            <tr>
              <th scope="col">Address</th>
              <th scope="col">Hits</th>
              <th scope="col">Last seen</th>
              <th scope="col">Referrer</th>
              <th scope="col">Redirect to</th>
              <th scope="col">Type</th>
              <th scope="col"><span className="nf-visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row"><code>{row.path}</code></th>
                <td>{row.hitCount}</td>
                <td>{dateTime(row.lastSeen)}</td>
                <td className="nf-referrer">{row.referrer ?? '-'}</td>
                <td>
                  <input
                    aria-label={`Redirect target for ${row.path}`}
                    className="nf-input"
                    value={targets[row.id] ?? ''}
                    placeholder="/new-page or https://..."
                    onChange={(event) => setTargets((prev) => ({ ...prev, [row.id]: event.target.value }))}
                  />
                </td>
                <td>
                  <select
                    aria-label={`Redirect type for ${row.path}`}
                    className="nf-select"
                    value={types[row.id] ?? '301'}
                    onChange={(event) => setTypes((prev) => ({ ...prev, [row.id]: event.target.value }))}
                  >
                    {REDIRECT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </td>
                <td className="nf-actions">
                  <button
                    type="button"
                    className="nf-button nf-button--primary"
                    disabled={busy === row.id || !(targets[row.id] ?? '').trim()}
                    onClick={() => send(row.id, { action: 'redirect', toPath: (targets[row.id] ?? '').trim(), redirectType: types[row.id] ?? '301' })}
                  >
                    Create redirect
                  </button>
                  <button type="button" className="nf-button" disabled={busy === row.id} onClick={() => send(row.id, { action: 'dismiss' })}>
                    Dismiss
                  </button>
                  {message?.id === row.id && <span role="alert" className="nf-error">{message.text}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
