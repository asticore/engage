'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { SuppressionRow } from '@/features/email/suppressionAdmin'

const REASON_LABELS: Record<string, string> = {
  unsubscribed: 'Unsubscribed',
  bounced: 'Bounced',
  complaint: 'Complaint',
  provider: 'Provider',
}

/** The rows of the suppression list, each with a Remove button. Removing calls the admin API, then refreshes the screen. */
export function EmailSuppressionsClient({ rows }: { rows: SuppressionRow[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const remove = async (email: string) => {
    setBusy(email)
    setError(null)
    try {
      const response = await fetch('/api/admin-email-suppressions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? 'Could not remove this address. Try again.')
        return
      }
      router.refresh()
    } catch {
      setError('Could not reach the server. Try again.')
    } finally {
      setBusy(null)
    }
  }

  if (rows.length === 0) return <p role="status">No addresses on the list.</p>

  return (
    <>
      {error && <p role="alert" className="doc-muted">{error}</p>}
      <div className="lst-table-wrap" style={{ overflowX: 'auto' }}>
        <table className="lst-table">
          <caption className="doc-muted">Showing up to {rows.length} addresses, newest first.</caption>
          <thead>
            <tr>
              <th scope="col">Address</th>
              <th scope="col">Reason</th>
              <th scope="col">Source</th>
              <th scope="col">Added</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.email}>
                <td>{row.email}</td>
                <td>{REASON_LABELS[row.reason] ?? row.reason}</td>
                <td>{row.source}</td>
                <td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : ''}</td>
                <td>
                  <button type="button" className="list-toolbar-btn" disabled={busy === row.email} onClick={() => remove(row.email)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
