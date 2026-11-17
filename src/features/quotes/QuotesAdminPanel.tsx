'use client'

import { useCallback, useEffect, useState } from 'react'

type Line = { description: string; quantity: number; unitCents: number }
type Req = { id: number; number: string; kind: string; status: string; name: string; email: string; phone: string; quantity: number; details: string; deadline: string; offerCents: number | null; currency: string; lines: Line[]; totalCents: number | null; validUntil: string | null; counterNote: string; counterCents: number | null; orderId: number | null; pageUrl: string; activity: { at: string; by: string; text: string }[] }
type Draft = { lines: { description: string; quantity: string; unit: string }[]; validDays: string; terms: string; message: string }

const blank = (r: Req): Draft => ({
  lines: r.lines.length ? r.lines.map((l) => ({ description: l.description, quantity: String(l.quantity), unit: (l.unitCents / 100).toFixed(2) })) : [{ description: r.details.split('\n')[0]?.slice(0, 120) || 'Item', quantity: String(r.quantity), unit: r.offerCents ? (r.offerCents / 100).toFixed(2) : '' }],
  validDays: '14',
  terms: '',
  message: 'Thanks for asking. Here is your quote.',
})
const money = (c: number, cur: string): string => new Intl.NumberFormat('en-AU', { style: 'currency', currency: cur }).format(c / 100)

/** The files a customer attached to one request, as download links. Loads when the request is shown. */
function Attachments({ number }: { number: string }) {
  const [files, setFiles] = useState<{ key: string; name: string; size: number }[]>([])
  useEffect(() => {
    let live = true
    fetch(`/api/admin-quote-file?number=${encodeURIComponent(number)}`)
      .then(async (res) => ((await res.json().catch(() => ({}))) as { files?: { key: string; name: string; size: number }[] }).files ?? [])
      .then((list) => {
        if (live) setFiles(list)
      })
      .catch((): void => undefined)
    return () => {
      live = false
    }
  }, [number])
  if (files.length === 0) return null
  return (
    <p className="text-muted">
      Files:{' '}
      {files.map((f) => (
        <a key={f.key} href={`/api/admin-quote-file?number=${encodeURIComponent(number)}&key=${encodeURIComponent(f.key)}`} style={{ marginRight: 12 }}>{f.name} ({Math.max(1, Math.round(f.size / 1024))} KB)</a>
      ))}
    </p>
  )
}

/** The request inbox: what people asked for, a quote builder with merge tags like {{name}} in the message, and the activity log. */
export function QuotesAdminPanel() {
  const [requests, setRequests] = useState<Req[] | null>(null)
  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)

  const load = useCallback(async (): Promise<void> => {
    const res = await fetch(`/api/admin-quotes${filter ? `?status=${filter}` : ''}`)
    const body = (await res.json().catch(() => ({}))) as { requests?: Req[]; error?: string }
    if (!res.ok) return setMessage(body.error ?? 'Could not load requests.')
    setRequests(body.requests ?? [])
  }, [filter])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (payload: Record<string, unknown>, okText = ''): Promise<boolean> => {
    setMessage('')
    const res = await fetch('/api/admin-quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      setMessage(body.error ?? 'That did not work.')
      return false
    }
    if (okText) setMessage(okText)
    await load()
    return true
  }

  if (!requests) return message ? <p role="alert" className="badge">{message}</p> : <p>Loading…</p>
  const choose = (r: Req): void => {
    setOpen(open === r.id ? null : r.id)
    setDraft(blank(r))
  }
  const setLine = (i: number, key: 'description' | 'quantity' | 'unit', value: string): void => draft && setDraft({ ...draft, lines: draft.lines.map((l, n) => (n === i ? { ...l, [key]: value } : l)) })

  return (
    <div className="stack">
      {message ? <p role="alert" className="badge">{message}</p> : null}
      <label className="field">Show
        <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All</option>
          {['new', 'quoted', 'countered', 'accepted', 'declined', 'expired', 'closed'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      {requests.length === 0 ? <p className="text-muted">No requests yet. Customers can use /request-quote, or you can put the form on a page.</p> : null}
      {requests.map((r) => (
        <div key={r.id} className="card">
          <div className="card-body stack">
            <strong>{r.number} · {r.kind === 'bid' ? 'Offer' : r.kind === 'item' ? 'Item request' : 'Quote request'} · {r.status}</strong>
            <p>{r.name} ({r.email}{r.phone ? `, ${r.phone}` : ''}). Quantity {r.quantity}{r.deadline ? `, needed by ${r.deadline}` : ''}{r.offerCents ? `. Offer ${money(r.offerCents, r.currency)}` : ''}.</p>
            {r.details ? <p style={{ whiteSpace: 'pre-wrap' }}>{r.details}</p> : null}
            <Attachments number={r.number} />
            {r.totalCents !== null ? <p className="text-muted">Quoted {money(r.totalCents, r.currency)}{r.validUntil ? `, valid until ${r.validUntil.slice(0, 10)}` : ''}.</p> : null}
            {r.counterNote || r.counterCents ? <p className="text-muted">Customer replied: {r.counterNote}{r.counterCents ? ` (would pay ${money(r.counterCents, r.currency)})` : ''}</p> : null}
            {r.orderId ? <p className="text-muted">Order {r.orderId} is in Orders. Mark it paid there when the money arrives.</p> : null}
            <div className="cluster">
              {r.status !== 'accepted' ? <button type="button" className="btn" onClick={() => choose(r)}>{open === r.id ? 'Hide' : r.status === 'new' ? 'Write quote' : 'Edit and resend quote'}</button> : null}
              {['new', 'quoted', 'countered', 'expired'].includes(r.status) ? <button type="button" className="btn" onClick={() => void post({ action: 'setStatus', id: r.id, status: 'declined' })}>Decline</button> : null}
              {['new', 'quoted', 'countered', 'expired'].includes(r.status) ? <button type="button" className="btn" onClick={() => void post({ action: 'setStatus', id: r.id, status: 'closed' })}>Close</button> : null}
              <button type="button" className="btn" onClick={() => void post({ action: 'delete', id: r.id })}>Delete</button>
            </div>
            {open === r.id && draft ? (
              <div className="stack">
                {draft.lines.map((l, i) => (
                  <div key={i} className="cluster">
                    <label className="field">Line<input className="input" value={l.description} onChange={(e) => setLine(i, 'description', e.target.value)} /></label>
                    <label className="field">Qty<input className="input" type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, 'quantity', e.target.value)} /></label>
                    <label className="field">Price each<input className="input" inputMode="decimal" value={l.unit} onChange={(e) => setLine(i, 'unit', e.target.value)} /></label>
                  </div>
                ))}
                <div className="cluster">
                  <button type="button" className="btn" onClick={() => setDraft({ ...draft, lines: [...draft.lines, { description: '', quantity: '1', unit: '' }] })}>Add a line</button>
                  {draft.lines.length > 1 ? <button type="button" className="btn" onClick={() => setDraft({ ...draft, lines: draft.lines.slice(0, -1) })}>Remove last line</button> : null}
                </div>
                <label className="field">Open for (days)<input className="input" type="number" min={1} value={draft.validDays} onChange={(e) => setDraft({ ...draft, validDays: e.target.value })} /></label>
                <label className="field">Message in the email. Merge tags: {'{{name}}'}, {'{{number}}'}, {'{{total}}'}, {'{{validUntil}}'}, {'{{link}}'}<textarea className="input" rows={3} value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} /></label>
                <label className="field">Terms<textarea className="input" rows={3} value={draft.terms} onChange={(e) => setDraft({ ...draft, terms: e.target.value })} /></label>
                <button type="button" className="btn" onClick={() => void post({ action: 'sendQuote', id: r.id, lines: draft.lines, validDays: draft.validDays, terms: draft.terms, message: draft.message }, 'Quote sent.').then((ok) => { if (ok) setOpen(null) })}>Send quote</button>
              </div>
            ) : null}
            <details>
              <summary>Activity</summary>
              {r.activity.map((a, i) => <p key={i} className="text-muted">{a.at.slice(0, 16).replace('T', ' ')} {a.by}: {a.text}</p>)}
            </details>
          </div>
        </div>
      ))}
    </div>
  )
}
