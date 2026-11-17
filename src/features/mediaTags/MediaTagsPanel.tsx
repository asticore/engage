'use client'

import { useCallback, useEffect, useState } from 'react'

import { splitCsv } from './logic'

type Tag = { id: number; name: string; parentId: number | null; color: string }
type Node = Tag & { count: number; total: number; children: Node[] }

const CSV_CHUNK = 900_000
const blank = { id: 0, name: '', parentId: 0, color: '#3366cc' }

/** Tag manager: the tag tree with colours and counts, add, edit, delete, and CSV import and export. */
export function MediaTagsPanel() {
  const [tags, setTags] = useState<Tag[]>([])
  const [tree, setTree] = useState<Node[]>([])
  const [message, setMessage] = useState('')
  const [form, setForm] = useState(blank)
  const [csv, setCsv] = useState('')
  const [kind, setKind] = useState<'importTags' | 'importFiles'>('importTags')

  const load = useCallback(async (): Promise<void> => {
    const res = await fetch('/api/admin-media-tags')
    const body = (await res.json().catch(() => ({}))) as { tags?: Tag[]; tree?: Node[]; error?: string }
    if (!res.ok) return setMessage(body.error ?? 'Could not load the tags.')
    setTags(body.tags ?? [])
    setTree(body.tree ?? [])
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (payload: Record<string, unknown>, okText = ''): Promise<Record<string, unknown> | null> => {
    setMessage('')
    const res = await fetch('/api/admin-media-tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      setMessage(String(body.error ?? 'That did not work.'))
      return null
    }
    if (okText) setMessage(okText)
    await load()
    return body
  }

  /** Sends the CSV in pieces of at most CSV_CHUNK characters (header repeated), so a file over the 1 MB request limit still imports. */
  const importCsv = async (): Promise<void> => {
    let created = 0
    let linked = 0
    let missing = 0
    for (const part of splitCsv(csv, CSV_CHUNK)) {
      const r = await post({ action: kind, csv: part })
      if (!r) return
      created += Number(r.created ?? 0)
      linked += Number(r.linked ?? 0)
      missing += Number(r.missing ?? 0)
    }
    setMessage(kind === 'importTags' ? `Created ${created} tags.` : `Linked ${linked} tags to files. ${missing} filenames were not found.`)
    setCsv('')
  }

  const row = (n: Node, depth: number): React.ReactNode => (
    <li key={n.id} style={{ listStyle: 'none', paddingLeft: depth * 16 }}>
      <div className="cluster">
        <span aria-hidden style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 6, background: n.color }} />
        <strong>{n.name}</strong>
        <span className="text-muted">{n.count} file{n.count === 1 ? '' : 's'}{n.children.length ? `, ${n.total} with sub-tags` : ''}</span>
        <button type="button" className="btn" onClick={() => setForm({ id: n.id, name: n.name, parentId: n.parentId ?? 0, color: n.color })}>Edit</button>
        <button type="button" className="btn" onClick={() => { if (window.confirm(`Delete tag ${n.name}? Its sub-tags move up one level and files keep existing.`)) void post({ action: 'deleteTag', id: n.id }, 'Tag deleted.') }}>Delete</button>
      </div>
      {n.children.length ? <ul className="stack" style={{ margin: 0, padding: 0 }}>{n.children.map((c) => row(c, depth + 1))}</ul> : null}
    </li>
  )

  return (
    <div className="stack">
      {message ? <p role="alert" className="badge">{message}</p> : null}
      <p className="text-muted">Tags are a second way to organise files, next to folders. A file can have many tags. Filtering by a tag also shows files with any of its sub-tags. Tag files from the Media page: select files, pick a tag, press Add tag.</p>
      <h2>Tags</h2>
      {tree.length === 0 ? <p className="text-muted">No tags yet.</p> : <ul className="stack" style={{ margin: 0, padding: 0 }}>{tree.map((n) => row(n, 0))}</ul>}
      <div className="card">
        <div className="card-body stack">
          <strong>{form.id ? 'Edit tag' : 'Add a tag'}</strong>
          <div className="cluster">
            <label className="field">Name<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="field">Inside
              <select className="input" value={form.parentId} onChange={(e) => setForm({ ...form, parentId: Number(e.target.value) })}>
                <option value={0}>Top level</option>
                {tags.filter((t) => t.id !== form.id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label className="field">Colour<input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></label>
          </div>
          <div className="cluster">
            <button type="button" className="btn" onClick={() => void post({ action: 'saveTag', ...form, id: form.id || undefined, parentId: form.parentId || null }, 'Saved.').then((r) => { if (r) setForm(blank) })}>{form.id ? 'Save changes' : 'Add tag'}</button>
            {form.id ? <button type="button" className="btn" onClick={() => setForm(blank)}>Cancel</button> : null}
          </div>
        </div>
      </div>
      <h2>Import and export</h2>
      <div className="cluster">
        <a className="btn" href="/api/admin-media-tags?export=tags">Download tags CSV</a>
        <a className="btn" href="/api/admin-media-tags?export=files">Download files CSV</a>
      </div>
      <p className="text-muted">Tags CSV has the columns tag and color; nest with &quot;Parent &gt; Child&quot;. Files CSV has filename and tags (several tags separated by ;). Import adds what is missing and never removes anything.</p>
      <div className="card">
        <div className="card-body stack">
          <label className="field">Import
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="importTags">Tags CSV</option>
              <option value="importFiles">Files CSV</option>
            </select>
          </label>
          <textarea className="input" rows={6} value={csv} onChange={(e) => setCsv(e.target.value)} aria-label="CSV text" />
          <div className="cluster">
            <button type="button" className="btn" onClick={() => void importCsv()}>Import</button>
            <input type="file" accept=".csv,text/csv" aria-label="Choose a CSV file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void f.text().then(setCsv) }} />
          </div>
        </div>
      </div>
    </div>
  )
}
