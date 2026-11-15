'use client'

import { useEffect, useState } from 'react'

type Line = { description: string; quantity: number; unitCents: number }
type View = { number: string; kind: string; status: string; name: string; currency: string; lines: Line[]; totalCents: number | null; validUntil: string | null; terms: string; counterNote: string; counterCents: number | null; answerable: boolean }

const money = (cents: number, currency: string): string => {
  try {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}

/** The page behind the private link in the quote email: read the quote, accept it, decline it or send a counter-offer. */
export function QuoteView({ token }: { token: string }) {
  const [view, setView] = useState<View | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [amount, setAmount] = useState('')
  const [done, setDone] = useState('')

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/quote-view?token=${encodeURIComponent(token)}`)
      const body = (await res.json().catch(() => ({}))) as View & { error?: string }
      if (res.ok) setView(body)
      else setError(res.status === 404 ? 'We could not find that quote. Check the link in your email.' : (body.error ?? 'Could not load the quote.'))
    })()
  }, [token])

  const act = async (action: 'accept' | 'decline' | 'counter'): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/quote-view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, action, note, amount }) })
      const body = (await res.json().catch(() => ({}))) as View & { error?: string }
      if (res.ok) {
        setView(body)
        setDone(action === 'accept' ? 'Thanks. Your order is placed and the payment details are in your email.' : action === 'decline' ? 'We have let them know you declined.' : 'Your reply was sent. We will be in touch.')
      } else setError(body.error ?? 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  if (!view) return error ? <p role="alert" className="badge">{error}</p> : <p>Loading…</p>
  return (
    <div className="card">
      <div className="card-body stack">
        <strong>Quote {view.number} for {view.name}</strong>
        {view.lines.length > 0 ? (
          <table className="table">
            <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
            <tbody>{view.lines.map((l, i) => <tr key={i}><td>{l.description}</td><td>{l.quantity}</td><td>{money(l.unitCents, view.currency)}</td><td>{money(l.unitCents * l.quantity, view.currency)}</td></tr>)}</tbody>
          </table>
        ) : null}
        {view.totalCents !== null ? <p><strong>Total {money(view.totalCents, view.currency)}</strong></p> : null}
        {view.validUntil ? <p className="text-muted">Valid until {new Intl.DateTimeFormat('en-AU', { dateStyle: 'long' }).format(new Date(view.validUntil))}.</p> : null}
        {view.terms ? <p className="text-muted" style={{ whiteSpace: 'pre-wrap' }}>{view.terms}</p> : null}
        <p>Status: {view.status}.</p>
        {view.status === 'countered' ? <p className="text-muted">You sent a reply{view.counterCents ? ` offering ${money(view.counterCents, view.currency)}` : ''}. We will get back to you.</p> : null}
        {view.answerable ? (
          <>
            <div className="cluster">
              <button type="button" className="btn" disabled={busy} onClick={() => void act('accept')}>Accept and place order</button>
              <button type="button" className="btn" disabled={busy} onClick={() => void act('decline')}>Decline</button>
            </div>
            <label className="field">Want something changed? Tell us<textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
            <label className="field">Amount you would pay (optional)<input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <button type="button" className="btn" disabled={busy} onClick={() => void act('counter')}>Send counter-offer</button>
          </>
        ) : null}
        {done ? <p role="status" className="badge">{done}</p> : null}
        {error ? <p role="alert" className="badge">{error}</p> : null}
      </div>
    </div>
  )
}
