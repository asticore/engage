'use client'

import { useCallback, useEffect, useState } from 'react'

import { FEED_CHANNELS, FEED_CHANNEL_LABELS, type FeedChannel, type FeedProblem } from '../lib/feedRecords'

type Feed = { id: number; name: string; channel: FeedChannel; token: string; currency: string; priceTier: string; category: string; tag: string; includeOutOfStock: boolean; enabled: boolean; url: string }
type Preview = { total: number; problems: FeedProblem[]; sample: string }

const blank = { id: 0, name: '', channel: 'google' as FeedChannel, currency: '', priceTier: '', category: '', tag: '', includeOutOfStock: false, enabled: true }

/** Product feeds for Google, Meta, Pinterest and others: each has its own secret address, currency, price tier and filters. */
export function ProductFeedsPanel() {
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [form, setForm] = useState(blank)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<{ id: number; data: Preview } | null>(null)

  const load = useCallback(async (): Promise<void> => {
    const res = await fetch('/api/admin-product-feeds')
    const body = (await res.json().catch(() => ({}))) as { feeds?: Feed[]; error?: string }
    if (res.ok) setFeeds(body.feeds ?? [])
    else setMessage(body.error ?? 'Could not load the feeds.')
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (payload: Record<string, unknown>): Promise<boolean> => {
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin-product-feeds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setMessage(body.error ?? 'That did not work.')
        return false
      }
      await load()
      return true
    } finally {
      setBusy(false)
    }
  }

  const runPreview = async (id: number): Promise<void> => {
    setMessage('')
    const res = await fetch(`/api/admin-product-feeds?preview=${id}`)
    const body = (await res.json().catch(() => ({}))) as Preview & { error?: string }
    if (res.ok) setPreview({ id, data: body })
    else setMessage(body.error ?? 'Could not build the preview.')
  }

  const set = <K extends keyof typeof blank>(key: K, value: (typeof blank)[K]): void => setForm({ ...form, [key]: value })

  return (
    <div className="stack">
      {message ? <p role="alert" className="badge">{message}</p> : null}
      {feeds.length === 0 ? <p className="text-muted">No feeds yet. Add one below.</p> : null}
      {feeds.map((f) => (
        <div key={f.id} className="card">
          <div className="card-body stack">
            <strong>{f.name}{f.enabled ? '' : ' (off)'}</strong>
            <p className="text-muted">{FEED_CHANNEL_LABELS[f.channel]}. Currency {f.currency || 'shop currency'}. Price tier {f.priceTier || 'normal price'}. {f.category ? `Category ${f.category}. ` : ''}{f.tag ? `Tag ${f.tag}. ` : ''}{f.includeOutOfStock ? 'Includes out of stock.' : 'Skips out of stock.'}</p>
            <input className="input" readOnly value={f.url} onFocus={(e) => e.currentTarget.select()} aria-label={`Address of ${f.name}`} />
            <div className="cluster">
              <button type="button" className="btn" onClick={() => setForm({ id: f.id, name: f.name, channel: f.channel, currency: f.currency, priceTier: f.priceTier, category: f.category, tag: f.tag, includeOutOfStock: f.includeOutOfStock, enabled: f.enabled })}>Edit</button>
              <button type="button" className="btn" onClick={() => void runPreview(f.id)}>Preview</button>
              <button type="button" className="btn" disabled={busy} onClick={() => void post({ id: f.id, action: 'rotate' })}>New address</button>
              <button type="button" className="btn" disabled={busy} onClick={() => void post({ id: f.id, action: 'delete' })}>Delete</button>
            </div>
            {preview?.id === f.id ? (
              <div className="stack">
                <p>{preview.data.total} rows. {preview.data.problems.length === 0 ? 'Nothing the channel would reject.' : `${preview.data.problems.length} problems:`}</p>
                {preview.data.problems.slice(0, 20).map((p, i) => <p key={i} className="text-muted">{p.id}: {p.message}</p>)}
                <pre className="text-muted" style={{ whiteSpace: 'pre-wrap', maxHeight: 240, overflow: 'auto' }}>{preview.data.sample}</pre>
              </div>
            ) : null}
          </div>
        </div>
      ))}
      <div className="card">
        <div className="card-body stack">
          <strong>{form.id ? 'Edit feed' : 'Add a feed'}</strong>
          <div className="cluster">
            <label className="field">Name<input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
            <label className="field">Channel
              <select className="input" value={form.channel} onChange={(e) => set('channel', e.target.value as FeedChannel)}>
                {FEED_CHANNELS.map((c) => <option key={c} value={c}>{FEED_CHANNEL_LABELS[c]}</option>)}
              </select>
            </label>
            <label className="field">Currency (blank is the shop currency)<input className="input" maxLength={3} value={form.currency} onChange={(e) => set('currency', e.target.value)} /></label>
            <label className="field">Price tier (customer type)<input className="input" value={form.priceTier} onChange={(e) => set('priceTier', e.target.value)} /></label>
          </div>
          <div className="cluster">
            <label className="field">Only this category (slug)<input className="input" value={form.category} onChange={(e) => set('category', e.target.value)} /></label>
            <label className="field">Only this tag (slug)<input className="input" value={form.tag} onChange={(e) => set('tag', e.target.value)} /></label>
            <label className="field"><span><input type="checkbox" checked={form.includeOutOfStock} onChange={(e) => set('includeOutOfStock', e.target.checked)} /> Include out of stock</span></label>
            <label className="field"><span><input type="checkbox" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} /> Feed is on</span></label>
          </div>
          <div className="cluster">
            <button type="button" className="btn" disabled={busy} onClick={() => void post(form.id ? form : { ...form, id: undefined }).then((ok) => { if (ok) setForm(blank) })}>{form.id ? 'Save changes' : 'Add feed'}</button>
            {form.id ? <button type="button" className="btn" onClick={() => setForm(blank)}>Cancel</button> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
