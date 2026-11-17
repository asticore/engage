'use client'

import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

type Action = 'ban' | 'unban' | 'revokeSessions' | 'setRole'
type Result = { id: number; email: string; ok: boolean; error?: string }

const LABELS: Record<Action, string> = { ban: 'Ban', unban: 'Unban', revokeSessions: 'Sign out everywhere', setRole: 'Change role' }

/** Bulk actions for staff and member users (Task 19f). Uses the same `data-bulk-row` checkboxes as the other lists. */
export function UsersBulkBar() {
  const router = useRouter()
  const [ids, setIds] = useState<number[]>([])
  const [action, setAction] = useState<Action | ''>('')
  const [reason, setReason] = useState('')
  const [days, setDays] = useState('')
  const [role, setRole] = useState('viewer')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [failures, setFailures] = useState<Result[]>([])

  useEffect(() => {
    const sync = (event: Event) => {
      const target = event.target as HTMLInputElement | null
      if (!target || target.tagName !== 'INPUT') return
      if (target.hasAttribute('data-bulk-all')) {
        for (const box of document.querySelectorAll<HTMLInputElement>('input[data-bulk-row]')) box.checked = target.checked
      } else if (!target.hasAttribute('data-bulk-row')) return
      setIds(Array.from(document.querySelectorAll<HTMLInputElement>('input[data-bulk-row]:checked')).map((b) => Number(b.value)))
      setConfirming(false)
    }
    document.addEventListener('change', sync)
    return () => document.removeEventListener('change', sync)
  }, [])

  const run = async () => {
    setBusy(true)
    setMessage(null)
    setFailures([])
    try {
      const res = await fetch('/api/admin-user-bulk', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids, reason, days, role }),
      })
      const data = (await res.json().catch((): null => null)) as { error?: string; done?: number; results?: Result[] } | null
      if (!res.ok || !data) {
        setMessage(data?.error ?? 'Something went wrong.')
      } else {
        setMessage(`${data.done ?? 0} of ${ids.length} users changed.`)
        setFailures((data.results ?? []).filter((r) => !r.ok))
        setConfirming(false)
        router.refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="es-bulk" role="region" aria-label="Bulk actions for users">
      <span>{ids.length} selected</span>
      <select aria-label="Action" value={action} onChange={(e) => { setAction(e.target.value as Action | ''); setConfirming(false) }}>
        <option value="">Choose an action…</option>
        {(Object.keys(LABELS) as Action[]).map((a) => <option key={a} value={a}>{LABELS[a]}</option>)}
      </select>
      {action === 'ban' && (
        <>
          <input aria-label="Reason" maxLength={300} placeholder="Reason (private)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <input aria-label="Days" inputMode="numeric" placeholder="Days (empty = permanent)" value={days} onChange={(e) => setDays(e.target.value)} />
        </>
      )}
      {action === 'setRole' && (
        <select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
      )}
      {!confirming ? (
        <button className="btn" disabled={ids.length === 0 || action === ''} onClick={() => setConfirming(true)} type="button">Apply</button>
      ) : (
        <>
          <span>{`${LABELS[action as Action]} ${ids.length} user${ids.length === 1 ? '' : 's'}?`}</span>
          <button className="btn" disabled={busy} onClick={run} type="button">Confirm</button>
          <button className="btn" disabled={busy} onClick={() => setConfirming(false)} type="button">Cancel</button>
        </>
      )}
      {message && <p role="status">{message}</p>}
      {failures.length > 0 && <ul>{failures.map((f) => <li key={f.id}>{f.email}: {f.error}</li>)}</ul>}
    </div>
  )
}
