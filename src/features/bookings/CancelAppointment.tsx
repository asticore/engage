'use client'

import { useState } from 'react'

/** Cancel button for one appointment on the account page. Reloads the page when it worked. */
export function CancelAppointment({ id }: { id: number }): React.ReactElement {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const cancel = async (): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/account-appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'cancel' }) })
      const body = (await res.json().catch((): { error?: string } => ({}))) as { error?: string }
      if (res.ok) window.location.reload()
      else setError(body.error ?? 'That did not work.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button type="button" className="btn" disabled={busy} onClick={() => void cancel()}>Cancel appointment</button>
      {error ? <p role="alert" className="form-error">{error}</p> : null}
    </>
  )
}
