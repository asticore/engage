'use client'

import { useState } from 'react'

type Row = { ref: string; title: string; slug: string; ok: boolean; problems: string[] }
type Created = { created: { id: number; title: string; slug: string }[]; failed: { ref: string; title: string; message: string }[]; skipped: number }

const LABELS = { pages: 'Pages', posts: 'Posts', products: 'Products' } as const
type Collection = keyof typeof LABELS

/** Paste titles (one per line) or a CSV with title, slug, parent and template columns; check the plan; create the drafts; undo. */
export function BulkCreatePanel() {
  const [collection, setCollection] = useState<Collection>('pages')
  const [text, setText] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [done, setDone] = useState<Created | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const call = async (action: 'preview' | 'create' | 'undo', ids?: number[]): Promise<Record<string, unknown> | null> => {
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin-bulk-create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, collection, text, ids }) })
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string }
      if (!res.ok) {
        setMessage(body.error ?? 'That did not work.')
        return null
      }
      return body
    } finally {
      setBusy(false)
    }
  }

  const onFile = async (file: File | undefined): Promise<void> => {
    if (file) setText(await file.text())
    setRows(null)
  }

  const preview = async (): Promise<void> => {
    setDone(null)
    const body = await call('preview')
    if (body) setRows(body.rows as Row[])
  }
  const create = async (): Promise<void> => {
    const body = await call('create')
    if (body) {
      setDone(body as unknown as Created)
      setRows(null)
    }
  }
  const undo = async (): Promise<void> => {
    if (!done) return
    const body = await call('undo', done.created.map((c) => c.id))
    if (body) {
      const kept = (body.kept as unknown[]).length
      setMessage(`Removed ${String(body.removed)} drafts.${kept ? ` ${kept} kept (published, older than a day, or already gone).` : ''}`)
      setDone(null)
    }
  }

  const creatable = rows?.filter((r) => r.ok).length ?? 0

  return (
    <div className="stack">
      <div className="cluster">
        <label className="field">Create
          <select className="input" value={collection} onChange={(e) => { setCollection(e.target.value as Collection); setRows(null) }}>
            {(Object.keys(LABELS) as Collection[]).map((c) => <option key={c} value={c}>{LABELS[c]}</option>)}
          </select>
        </label>
        <label className="field">Or upload a CSV<input className="input" type="file" accept=".csv,text/csv,text/plain" onChange={(e) => void onFile(e.target.files?.[0])} /></label>
      </div>
      <label className="field">Titles, one per line, or CSV text with a title column (and optional slug, parent, template)
        <textarea className="input" rows={10} value={text} onChange={(e) => { setText(e.target.value); setRows(null) }} />
      </label>
      <div className="cluster">
        <button type="button" className="btn" disabled={busy || !text.trim()} onClick={() => void preview()}>{busy ? 'Working…' : 'Check the list'}</button>
        {rows ? <button type="button" className="btn" disabled={busy || creatable === 0} onClick={() => void create()}>Create {creatable} drafts</button> : null}
      </div>
      {message ? <p role="alert" className="badge">{message}</p> : null}
      {rows ? (
        <table className="table">
          <thead><tr><th>Row</th><th>Title</th><th>Address</th><th>Result</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.ref}><td>{r.ref}</td><td>{r.title}</td><td>{r.slug}</td><td>{r.ok ? 'Will be created' : r.problems.join(' ')}</td></tr>)}
          </tbody>
        </table>
      ) : null}
      {done ? (
        <div className="card">
          <div className="card-body stack">
            <strong>Created {done.created.length} drafts. {done.skipped} skipped, {done.failed.length} failed.</strong>
            {done.failed.map((f) => <p key={f.ref} className="text-muted">{f.ref} {f.title}: {f.message}</p>)}
            <p className="text-muted">They are drafts. Undo removes them as long as none has been published and they are less than a day old.</p>
            <button type="button" className="btn" disabled={busy || done.created.length === 0} onClick={() => void undo()}>Undo this batch</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
