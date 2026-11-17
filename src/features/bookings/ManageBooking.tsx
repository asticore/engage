'use client'

import { useEffect, useState } from 'react'

type View = { number: string; status: string; start: string; timeZone: string; typeTitle: string; customerName: string; cancellable: boolean; note?: string }

/** The page behind the private link in the confirmation email: see the booking and cancel it. */
export function ManageBooking({ token }: { token: string }) {
  const [view, setView] = useState<View | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/booking-manage?token=${encodeURIComponent(token)}`)
      const body = (await res.json().catch(() => ({}))) as View & { error?: string }
      if (res.ok) setView(body)
      else setError(res.status === 404 ? 'We could not find that booking. Check the link in your email.' : (body.error ?? 'Could not load the booking.'))
    })()
  }, [token])

  const cancel = async (): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/booking-manage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, action: 'cancel' }) })
      const body = (await res.json().catch(() => ({}))) as View & { error?: string }
      if (res.ok) setView(body)
      else setError(body.error ?? 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  if (!view) return error ? <p role="alert" className="badge">{error}</p> : <p>Loading…</p>
  const when = new Intl.DateTimeFormat('en-AU', { dateStyle: 'full', timeStyle: 'short', timeZone: view.timeZone }).format(new Date(view.start))
  return (
    <div className="card">
      <div className="card-body stack">
        <strong>{view.typeTitle}</strong>
        <p>{when} ({view.timeZone.replace(/_/g, ' ')})</p>
        <p className="text-muted">Booking {view.number} for {view.customerName}. Status: {view.status.replace('_', ' ')}.</p>
        {view.status === 'confirmed' ? <a className="btn" href={`/api/booking-ics?token=${token}`}>Add to calendar</a> : null}
        {view.cancellable ? <button type="button" className="btn" disabled={busy} onClick={() => void cancel()}>Cancel this booking</button> : null}
        {view.status === 'pending_payment' ? <p className="text-muted">Waiting for payment. This time is held for you for 30 minutes. If you have just paid, refresh in a moment.</p> : null}
        {view.note ? <p>{view.note}</p> : null}
        {error ? <p role="alert" className="badge">{error}</p> : null}
      </div>
    </div>
  )
}
