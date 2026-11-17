'use client'

import { useState } from 'react'

const LABELS = { quote: 'Request a quote', bid: 'Make an offer', item: 'Request this item' } as const

/** The public form: a quote request, an offer (bid) or an item request. Drop it on a page or a product with a kind and an optional product id. */
export function RequestForm({ kind = 'quote', productId, productTitle }: { kind?: 'quote' | 'bid' | 'item'; productId?: number; productTitle?: string }) {
  const [values, setValues] = useState({ name: '', email: '', phone: '', quantity: '1', details: '', deadline: '', offer: '', website: '' })
  const [files, setFiles] = useState<File[]>([])
  const [state, setState] = useState<{ busy: boolean; error: string; number: string }>({ busy: false, error: '', number: '' })
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => setValues({ ...values, [key]: e.target.value })

  const submit = async (e: { preventDefault: () => void }): Promise<void> => {
    e.preventDefault()
    setState({ busy: true, error: '', number: '' })
    try {
      const payload = { ...values, kind, productId, pageUrl: window.location.pathname }
      let res: Response
      if (files.length > 0) {
        const data = new FormData()
        for (const [key, value] of Object.entries(payload)) if (value !== undefined) data.append(key, String(value))
        for (const file of files) data.append('files', file)
        res = await fetch('/api/quote-request', { method: 'POST', body: data })
      } else {
        res = await fetch('/api/quote-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      }
      const body = (await res.json().catch(() => ({}))) as { number?: string; error?: string }
      if (res.ok) setState({ busy: false, error: '', number: body.number ?? 'sent' })
      else setState({ busy: false, error: body.error ?? 'That did not work.', number: '' })
    } catch {
      setState({ busy: false, error: 'That did not work. Check your connection and try again.', number: '' })
    }
  }

  if (state.number) return <p role="status" className="badge">Thanks. We have your request{state.number !== 'sent' ? ` (${state.number})` : ''} and will email you.</p>
  return (
    <form className="stack" onSubmit={(e) => void submit(e)}>
      <strong>{LABELS[kind]}{productTitle ? `: ${productTitle}` : ''}</strong>
      <label className="field">Your name<input className="input" required value={values.name} onChange={set('name')} /></label>
      <label className="field">Email<input className="input" type="email" required value={values.email} onChange={set('email')} /></label>
      <label className="field">Phone (optional)<input className="input" value={values.phone} onChange={set('phone')} /></label>
      {kind === 'bid' ? <label className="field">Your offer<input className="input" inputMode="decimal" required value={values.offer} onChange={set('offer')} /></label> : null}
      <label className="field">Quantity<input className="input" type="number" min={1} value={values.quantity} onChange={set('quantity')} /></label>
      <label className="field">{kind === 'bid' ? 'Notes (optional)' : 'What do you need? Size, spec, anything we should know'}<textarea className="input" rows={4} required={kind !== 'bid'} value={values.details} onChange={set('details')} /></label>
      <label className="field">Needed by (optional)<input className="input" type="date" value={values.deadline} onChange={set('deadline')} /></label>
      <label className="field">Attach files (optional, up to 5)<input className="input" type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))} /></label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }} value={values.website} onChange={set('website')} />
      {state.error ? <p role="alert" className="badge">{state.error}</p> : null}
      <button type="submit" className="btn" disabled={state.busy}>{state.busy ? 'Sending…' : LABELS[kind]}</button>
    </form>
  )
}
