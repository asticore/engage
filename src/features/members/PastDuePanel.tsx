'use client'

import { useCallback, useEffect, useState } from 'react'

type Row = { id: number; email: string; name: string; tier: string; startedAt: string | null; attempts: number; nextAt: string | null; graceEndsAt: string | null; notes: string }

const day = (iso: string | null): string => (iso ? iso.slice(0, 10) : 'none')

/** Members whose renewal payment failed: where each is in the chase, retry the card now, or end it now. */
export function PastDuePanel() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [message, setMessage] = useState('')

  const load = useCallback(async (): Promise<void> => {
    const res = await fetch('/api/admin-member-dunning')
    const body = (await res.json().catch(() => ({}))) as { members?: Row[]; error?: string }
    if (!res.ok) return setMessage(body.error ?? 'Could not load members.')
    setRows(body.members ?? [])
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const act = async (id: number, action: 'retry' | 'end'): Promise<void> => {
    setMessage('')
    const res = await fetch('/api/admin-member-dunning', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) })
    const body = (await res.json().catch(() => ({}))) as { error?: string; paid?: boolean; result?: string }
    if (!res.ok) setMessage(body.error ?? 'That did not work.')
    else setMessage(action === 'end' ? (body.result === 'free-tier' ? 'Moved to the free tier.' : 'Membership ended.') : body.paid ? 'The card cleared.' : 'The card did not clear. The member will be emailed on the next scheduled retry.')
    await load()
  }

  if (!rows) return message ? <p role="alert" className="badge">{message}</p> : <p>Loading…</p>
  return (
    <div className="stack">
      {message ? <p role="status" className="badge">{message}</p> : null}
      <p className="text-muted">Retry days, the grace period and what happens at the end are set in Settings, Members, Billing.</p>
      {rows.length === 0 ? <p className="text-muted">No members are past due.</p> : (
        <table className="table">
          <thead><tr><th>Member</th><th>Tier</th><th>First failed</th><th>Attempts</th><th>Next retry</th><th>Access until</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}<br />{r.email}</td>
                <td>{r.tier}</td>
                <td>{day(r.startedAt)}</td>
                <td>{r.attempts}</td>
                <td>{day(r.nextAt)}</td>
                <td>{day(r.graceEndsAt)}</td>
                <td>
                  <div className="cluster">
                    <button type="button" className="btn" onClick={() => void act(r.id, 'retry')}>Retry card now</button>
                    <button type="button" className="btn" onClick={() => void act(r.id, 'end')}>End now</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
