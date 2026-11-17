'use client'

import { useCallback, useEffect, useState } from 'react'

type Rule = { id: number; title: string; productId: number | null; maxQty: number | null; windowDays: number; cooldownHours: number; requireVerified: boolean; active: boolean; message: string; exemptEmails: string }
type Block = { id: number; productId: number | null; reason: string; emailKey: string; detail: string; createdAt: string }
type Data = { rules: Rule[]; products: { id: number; title: string }[]; blocks: Block[]; counts: { today: number; week: number } }

const blank = { id: 0, title: '', productId: null as number | null, maxQty: '' as number | '', windowDays: 0, cooldownHours: 0, requireVerified: false, active: true, message: '', exemptEmails: '' }

/** Per-person limits on products and event tickets, and the attempts they refused. */
export function PurchaseLimitsPanel() {
  const [data, setData] = useState<Data | null>(null)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState(blank)

  const load = useCallback(async (): Promise<void> => {
    const res = await fetch('/api/admin-purchase-limits')
    const body = (await res.json().catch(() => ({}))) as Partial<Data> & { error?: string }
    if (!res.ok) return setMessage(body.error ?? 'Could not load the rules.')
    setData({ rules: body.rules ?? [], products: body.products ?? [], blocks: body.blocks ?? [], counts: body.counts ?? { today: 0, week: 0 } })
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (payload: Record<string, unknown>, okText = ''): Promise<boolean> => {
    setMessage('')
    const res = await fetch('/api/admin-purchase-limits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      setMessage(body.error ?? 'That did not work.')
      return false
    }
    if (okText) setMessage(okText)
    await load()
    return true
  }

  if (!data) return message ? <p role="alert" className="badge">{message}</p> : <p>Loading…</p>
  const name = (id: number | null): string => (id === null ? 'All products' : (data.products.find((p) => p.id === id)?.title ?? `Product ${id}`))
  const num = (key: 'maxQty' | 'windowDays' | 'cooldownHours', label: string) => (
    <label className="field">{label}<input className="input" type="number" min={0} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value === '' ? '' : Number(e.target.value) } as typeof form)} /></label>
  )
  const describe = (r: Rule): string => [r.maxQty !== null ? `most ${r.maxQty} per person${r.windowDays ? ` in ${r.windowDays} days` : ''}` : '', r.cooldownHours ? `wait ${r.cooldownHours} hours between orders` : '', r.requireVerified ? 'verified account only' : '', r.exemptEmails ? `${r.exemptEmails.split('\n').length} trusted customer(s) exempt` : ''].filter(Boolean).join(', ')

  return (
    <div className="stack">
      {message ? <p role="alert" className="badge">{message}</p> : null}
      <p className="text-muted">A person is matched by account, by email (ignoring +tags and Gmail dots) and by delivery address. Orders waiting for payment count. Event tickets are products, so a rule on the ticket product limits tickets.</p>
      <h2>Rules</h2>
      {data.rules.length === 0 ? <p className="text-muted">No rules yet.</p> : null}
      {data.rules.map((r) => (
        <div key={r.id} className="card">
          <div className="card-body stack">
            <strong>{r.title}{r.active ? '' : ' (off)'}</strong>
            <p className="text-muted">{name(r.productId)}: {describe(r)}.</p>
            <div className="cluster">
              <button type="button" className="btn" onClick={() => setForm({ ...r, maxQty: r.maxQty ?? '' })}>Edit</button>
              <button type="button" className="btn" onClick={() => void post({ action: 'saveRule', ...r, active: !r.active })}>{r.active ? 'Turn off' : 'Turn on'}</button>
              <button type="button" className="btn" onClick={() => void post({ action: 'deleteRule', id: r.id })}>Delete</button>
            </div>
          </div>
        </div>
      ))}
      <div className="card">
        <div className="card-body stack">
          <strong>{form.id ? 'Edit rule' : 'Add a rule'}</strong>
          <div className="cluster">
            <label className="field">Name<input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label className="field">Applies to
              <select className="input" value={form.productId ?? 0} onChange={(e) => setForm({ ...form, productId: Number(e.target.value) || null })}>
                <option value={0}>All products</option>
                {data.products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </label>
          </div>
          <div className="cluster">
            {num('maxQty', 'Most per person (blank: no limit)')}
            {num('windowDays', 'Over how many days (0: ever)')}
            {num('cooldownHours', 'Wait between orders (hours, 0: none)')}
          </div>
          <label className="field"><span><input type="checkbox" checked={form.requireVerified} onChange={(e) => setForm({ ...form, requireVerified: e.target.checked })} /> Only signed-in people with a verified email</span></label>
          <label className="field">Message shown when this rule refuses an order (blank: built-in wording; {'{{product}}'} is the product name)<input className="input" maxLength={300} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></label>
          <label className="field">Trusted customers the rule never refuses (one email per line)<textarea className="input" rows={3} value={form.exemptEmails} onChange={(e) => setForm({ ...form, exemptEmails: e.target.value })} /></label>
          <div className="cluster">
            <button type="button" className="btn" onClick={() => void post({ action: 'saveRule', ...form, id: form.id || undefined }, 'Saved.').then((ok) => { if (ok) setForm(blank) })}>{form.id ? 'Save changes' : 'Add rule'}</button>
            {form.id ? <button type="button" className="btn" onClick={() => setForm(blank)}>Cancel</button> : null}
          </div>
        </div>
      </div>
      <h2>Refused attempts</h2>
      <p className="text-muted">{data.counts.today} in the last day, {data.counts.week} in the last week.</p>
      {data.blocks.length === 0 ? <p className="text-muted">Nothing refused yet.</p> : (
        <table className="table">
          <thead><tr><th>When</th><th>Why</th><th>Product</th><th>Person</th><th>Message</th></tr></thead>
          <tbody>{data.blocks.map((b) => <tr key={b.id}><td>{b.createdAt.slice(0, 16).replace('T', ' ')}</td><td>{b.reason}</td><td>{b.productId ? name(b.productId) : ''}</td><td>{b.emailKey}</td><td>{b.detail}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  )
}
