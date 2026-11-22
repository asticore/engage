'use client'

import { useEffect, useRef, useState } from 'react'

type Row = { ref: string; title: string; slug: string; ok: boolean; problems: string[] }
type Created = { created: { id: number; title: string; slug: string }[]; failed: { ref: string; title: string; message: string }[]; skipped: number }
type Options = { parents: { slug: string; title: string }[]; templates: { id: string; title: string }[]; locales: string[]; defaultLocale: string }

/** "Add several pages" on the Pages screen: type one title per line, pick optional defaults, check the addresses, create. */
export function AddSeveralPages({ canPublish }: { canPublish: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [options, setOptions] = useState<Options | null>(null)
  const [text, setText] = useState('')
  const [parent, setParent] = useState('')
  const [template, setTemplate] = useState('')
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [locale, setLocale] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [done, setDone] = useState<Created | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const call = async (action: string, extra: Record<string, unknown> = {}): Promise<Record<string, unknown> | null> => {
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin-bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, collection: 'pages', text, defaults: { parent, template, status, locale }, ...extra }),
      })
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

  useEffect(() => () => dialog.current?.close(), [])

  const open = async (): Promise<void> => {
    dialog.current?.showModal()
    if (!options) {
      const body = await call('options')
      if (body) setOptions(body as unknown as Options)
    }
  }
  const check = async (): Promise<void> => {
    setDone(null)
    const body = await call('preview')
    if (body) setRows(body.rows as Row[])
  }
  const create = async (): Promise<void> => {
    const body = await call('create')
    if (body) {
      setDone(body as unknown as Created)
      setRows(null)
      setText('')
      setOptions(null)
      void call('options').then((o) => o && setOptions(o as unknown as Options))
    }
  }
  const undo = async (): Promise<void> => {
    if (!done) return
    const body = await call('undo', { ids: done.created.map((c) => c.id) })
    if (body) {
      const kept = (body.kept as unknown[]).length
      setMessage(`Removed ${String(body.removed)} pages.${kept ? ` ${kept} kept (published, older than a day, or already gone).` : ''}`)
      setDone(null)
    }
  }
  const close = (): void => {
    dialog.current?.close()
    if (done) window.location.reload()
  }

  const creatable = rows?.filter((r) => r.ok).length ?? 0
  const label = status === 'published' ? 'pages' : 'drafts'

  return (
    <>
      <button type="button" className="btn" onClick={() => void open()}>Add several pages</button>
      <dialog ref={dialog} className="card" style={{ maxWidth: 720, width: '92vw' }} onClose={() => setRows(null)}>
        <div className="card-body stack">
          <h2>Add several pages</h2>
          <label className="field">One page title per line
            <textarea className="input" rows={8} value={text} onChange={(e) => { setText(e.target.value); setRows(null) }} placeholder={'About us\nOur team\nContact'} />
          </label>
          <div className="cluster">
            <label className="field">Parent page
              <select className="input" value={parent} onChange={(e) => { setParent(e.target.value); setRows(null) }}>
                <option value="">None (top level)</option>
                {options?.parents.map((p) => <option key={p.slug} value={p.slug}>{p.title}</option>)}
              </select>
            </label>
            <label className="field">Template
              <select className="input" value={template} onChange={(e) => { setTemplate(e.target.value); setRows(null) }}>
                <option value="">None</option>
                {options?.templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </label>
            <label className="field">Status
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}>
                <option value="draft">Draft</option>
                {canPublish ? <option value="published">Published</option> : null}
              </select>
            </label>
            {options && options.locales.length > 1 ? (
              <label className="field">Language of these titles
                <select className="input" value={locale} onChange={(e) => setLocale(e.target.value)}>
                  <option value="">Default ({options.defaultLocale})</option>
                  {options.locales.filter((l) => l !== options.defaultLocale).map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </label>
            ) : null}
          </div>
          <div className="cluster">
            <button type="button" className="btn" disabled={busy || !text.trim()} onClick={() => void check()}>{busy ? 'Working…' : 'Show the addresses'}</button>
            {rows ? <button type="button" className="btn btn--primary" disabled={busy || creatable === 0} onClick={() => void create()}>Create {creatable} {label}</button> : null}
            <button type="button" className="btn" onClick={close}>Close</button>
          </div>
          {message ? <p role="alert" className="badge">{message}</p> : null}
          {rows ? (
            <table className="table">
              <thead><tr><th>Title</th><th>Address</th><th>Result</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.ref}><td>{r.title}</td><td>{r.slug ? `/${r.slug}` : ''}</td><td>{r.ok ? 'Will be created' : r.problems.join(' ')}</td></tr>)}</tbody>
            </table>
          ) : null}
          {done ? (
            <div className="stack">
              <strong>Created {done.created.length} pages. {done.skipped} skipped, {done.failed.length} failed.</strong>
              {done.failed.map((f) => <p key={f.ref} className="text-muted">{f.title}: {f.message}</p>)}
              <button type="button" className="btn" disabled={busy || done.created.length === 0} onClick={() => void undo()}>Undo this batch</button>
            </div>
          ) : null}
        </div>
      </dialog>
    </>
  )
}
