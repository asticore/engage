'use client'

import { useState } from 'react'

type Result = {
  customerFound: boolean
  customerTypes: string[]
  stats: { lifetimeSpendCents: number; orderCount: number }
  lines: { name: string; quantity: number; unitCents: number; lineCents: number; discountCents: number }[]
  subtotalCents: number
  rules: { id: string; name: string; cents: number }[]
  pricingRuleCents: number
  totalCents: number
}

const money = (cents: number): string => `$${(cents / 100).toFixed(2)}`

/** "What would this customer pay": runs the real checkout calculation for a made-up cart. Nothing is saved or sent. */
export function PricingPreviewPanel() {
  const [email, setEmail] = useState('')
  const [country, setCountry] = useState('AU')
  const [lines, setLines] = useState([{ product: '', quantity: '1' }])
  const [result, setResult] = useState<Result | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (): Promise<void> => {
    setBusy(true)
    setMessage('')
    setResult(null)
    try {
      const res = await fetch('/api/admin-pricing-preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, country, lines }) })
      const body = (await res.json().catch(() => ({}))) as Result & { error?: string }
      if (!res.ok) setMessage(body.error ?? 'That did not work.')
      else setResult(body)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <div className="cluster">
        <label className="field">Customer email (optional)<input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field">Ships to (country code)<input className="input" maxLength={2} value={country} onChange={(e) => setCountry(e.target.value)} /></label>
      </div>
      {lines.map((line, i) => (
        <div key={i} className="cluster">
          <label className="field">Product number<input className="input" inputMode="numeric" value={line.product} onChange={(e) => setLines(lines.map((l, j) => (j === i ? { ...l, product: e.target.value } : l)))} /></label>
          <label className="field">Quantity<input className="input" inputMode="numeric" value={line.quantity} onChange={(e) => setLines(lines.map((l, j) => (j === i ? { ...l, quantity: e.target.value } : l)))} /></label>
          {lines.length > 1 ? <button type="button" className="btn" onClick={() => setLines(lines.filter((_, j) => j !== i))}>Remove</button> : null}
        </div>
      ))}
      <div className="cluster">
        <button type="button" className="btn" onClick={() => setLines([...lines, { product: '', quantity: '1' }])}>Add product</button>
        <button type="button" className="btn" disabled={busy} onClick={() => void run()}>{busy ? 'Working…' : 'Preview'}</button>
      </div>
      {message ? <p role="alert" className="badge">{message}</p> : null}
      {result ? (
        <div className="card">
          <div className="card-body stack">
            <p className="text-muted">
              {email ? (result.customerFound ? 'Signed-in customer found.' : 'No account with that email, so no roles or company.') : 'Guest.'} Types: {result.customerTypes.join(', ') || 'none'}. Past orders: {result.stats.orderCount}, spent {money(result.stats.lifetimeSpendCents)}.
            </p>
            {result.lines.map((l, i) => <p key={i}>{l.name} x {l.quantity}: {money(l.lineCents)}{l.discountCents ? ` (discount ${money(l.discountCents)})` : ''}</p>)}
            {result.rules.length === 0 ? <p className="text-muted">No pricing rule applied.</p> : result.rules.map((r) => <p key={r.id}>Rule {r.name}: -{money(r.cents)}</p>)}
            <strong>Total {money(result.totalCents)}</strong>
          </div>
        </div>
      ) : null}
    </div>
  )
}
