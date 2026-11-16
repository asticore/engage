'use client'

import { useCallback, useEffect, useState } from 'react'

import { EMPTY_FILTERS, type SearchFilters } from './search'

type Doc = { id: number; filename: string | null; url: string | null; alt: string | null; mimeType: string | null; filesize: number | null; width: number | null; height: number | null; folder: string | null; status: string }
type Saved = { id: number; name: string; filters: SearchFilters }
type Field = { key: string; label: string; type: string; options: string[] }
type Meta = { saved: Saved[]; fields: Field[]; collections: Array<{ id: number; name: string }>; tags: Array<{ id: number; label: string }> }

const PAGE = 48

const toParams = (f: SearchFilters, page: number): string => {
  const p = new URLSearchParams({ search: '1', page: String(page), pageSize: String(PAGE) })
  for (const [k, v] of Object.entries(f)) {
    if (k === 'meta') for (const [mk, mv] of Object.entries(v as Record<string, string>)) p.set(`meta.${mk}`, mv)
    else if (v) p.set(k, String(v))
  }
  return p.toString()
}

/** Advanced media search: every filter in one form, saved searches and smart collections. */
export function MediaSearchPanel() {
  const [f, setF] = useState<SearchFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [docs, setDocs] = useState<Doc[]>([])
  const [total, setTotal] = useState(0)
  const [meta, setMeta] = useState<Meta>({ saved: [], fields: [], collections: [], tags: [] })
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')

  const loadMeta = useCallback(async () => {
    const res = await fetch('/api/admin-media-dam?searchMeta=1')
    if (res.ok) setMeta((await res.json()) as Meta)
  }, [])
  useEffect(() => {
    void loadMeta()
  }, [loadMeta])

  const run = useCallback(async (filters: SearchFilters, p: number) => {
    const res = await fetch(`/api/admin-media-dam?${toParams(filters, p)}`)
    const body = (await res.json().catch(() => ({}))) as { docs?: Doc[]; total?: number; error?: string }
    if (!res.ok) return setMessage(body.error ?? 'The search did not work.')
    setMessage('')
    setDocs(body.docs ?? [])
    setTotal(body.total ?? 0)
  }, [])
  useEffect(() => {
    void run(EMPTY_FILTERS, 1)
  }, [run])

  const set = <K extends keyof SearchFilters>(k: K, v: SearchFilters[K]): void => setF({ ...f, [k]: v })
  const go = (p: number): void => {
    setPage(p)
    void run(f, p)
  }
  const post = async (payload: Record<string, unknown>, ok: string): Promise<void> => {
    const res = await fetch('/api/admin-media-dam', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    setMessage(res.ok ? ok : (body.error ?? 'That did not work.'))
    if (res.ok) await loadMeta()
  }
  const pages = Math.max(1, Math.ceil(total / PAGE))

  return (
    <div className="stack">
      {message ? <p role="alert" className="badge">{message}</p> : null}
      <form className="card" onSubmit={(e) => { e.preventDefault(); setPage(1); void run(f, 1) }}>
        <div className="card-body stack">
          <div className="cluster">
            <label className="field">Words<input className="input" value={f.q} onChange={(e) => set('q', e.target.value)} placeholder="name, alt, caption, credit, details" /></label>
            <label className="field">Type
              <select className="input" value={f.type} onChange={(e) => set('type', e.target.value as SearchFilters['type'])}>
                <option value="">Any</option><option value="image">Pictures</option><option value="video">Video</option><option value="audio">Audio</option><option value="document">Documents</option>
              </select>
            </label>
            <label className="field">Folder<input className="input" value={f.folder} onChange={(e) => set('folder', e.target.value)} placeholder="products/summer" /></label>
            {meta.collections.length > 0 ? (
              <label className="field">Collection
                <select className="input" value={f.collectionId} onChange={(e) => set('collectionId', Number(e.target.value))}>
                  <option value={0}>Any</option>{meta.collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            ) : null}
            {meta.tags.length > 0 ? (
              <label className="field">Tag
                <select className="input" value={f.tagId} onChange={(e) => set('tagId', Number(e.target.value))}>
                  <option value={0}>Any</option>{meta.tags.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </label>
            ) : null}
          </div>
          <div className="cluster">
            <label className="field">Added from<input className="input" type="date" value={f.from} onChange={(e) => set('from', e.target.value)} /></label>
            <label className="field">Added to<input className="input" type="date" value={f.to} onChange={(e) => set('to', e.target.value)} /></label>
            <label className="field">Size from (KB)<input className="input" type="number" min={0} value={f.sizeMinKb || ''} onChange={(e) => set('sizeMinKb', Number(e.target.value))} /></label>
            <label className="field">Size up to (KB)<input className="input" type="number" min={0} value={f.sizeMaxKb || ''} onChange={(e) => set('sizeMaxKb', Number(e.target.value))} /></label>
            <label className="field">Width at least<input className="input" type="number" min={0} value={f.minWidth || ''} onChange={(e) => set('minWidth', Number(e.target.value))} /></label>
            <label className="field">Height at least<input className="input" type="number" min={0} value={f.minHeight || ''} onChange={(e) => set('minHeight', Number(e.target.value))} /></label>
            <label className="field">Shape
              <select className="input" value={f.orientation} onChange={(e) => set('orientation', e.target.value as SearchFilters['orientation'])}>
                <option value="">Any</option><option value="landscape">Landscape</option><option value="portrait">Portrait</option><option value="square">Square</option>
              </select>
            </label>
          </div>
          <div className="cluster">
            <label className="field">Status
              <select className="input" value={f.status} onChange={(e) => set('status', e.target.value as SearchFilters['status'])}>
                <option value="">Any</option><option value="draft">Draft</option><option value="in_review">In review</option><option value="approved">Approved</option><option value="archived">Archived</option>
              </select>
            </label>
            <label className="field">Licence
              <select className="input" value={f.licence} onChange={(e) => set('licence', e.target.value as SearchFilters['licence'])}>
                <option value="">Any</option><option value="expired">Expired</option><option value="expiring">Expiring soon</option><option value="embargoed">Embargoed</option><option value="flagged">Any problem</option>
              </select>
            </label>
            {meta.fields.map((fd) => (
              <label key={fd.key} className="field">{fd.label}
                {fd.type === 'select' ? (
                  <select className="input" value={f.meta[fd.key] ?? ''} onChange={(e) => set('meta', { ...f.meta, [fd.key]: e.target.value })}>
                    <option value="">Any</option>{fd.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : <input className="input" value={f.meta[fd.key] ?? ''} onChange={(e) => set('meta', { ...f.meta, [fd.key]: e.target.value })} />}
              </label>
            ))}
            <label className="field">Sort
              <select className="input" value={f.sort} onChange={(e) => set('sort', e.target.value as SearchFilters['sort'])}>
                <option value="newest">Newest</option><option value="oldest">Oldest</option><option value="name">Name</option><option value="size">Biggest</option>
              </select>
            </label>
          </div>
          <div className="cluster">
            <button type="submit" className="btn">Search</button>
            <button type="button" className="btn" onClick={() => { setF(EMPTY_FILTERS); setPage(1); void run(EMPTY_FILTERS, 1) }}>Clear</button>
          </div>
        </div>
      </form>

      <div className="card"><div className="card-body stack">
        <strong>Saved searches and smart collections</strong>
        <div className="cluster">
          <label className="field">Name<input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <button type="button" className="btn" onClick={() => void post({ action: 'saveSearch', name, filters: f }, 'Search saved.').then(() => setName(''))}>Save this search</button>
          <button type="button" className="btn" onClick={() => void post({ action: 'saveSmartCollection', name, filters: f }, 'Smart collection created. Its files follow the search.').then(() => setName(''))}>Make a smart collection</button>
        </div>
        {meta.saved.length === 0 ? <p className="text-muted">No saved searches yet.</p> : (
          <ul className="stack" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {meta.saved.map((s) => (
              <li key={s.id} className="cluster">
                <strong>{s.name}</strong>
                <button type="button" className="btn" onClick={() => { setF(s.filters); setPage(1); void run(s.filters, 1) }}>Run</button>
                <button type="button" className="btn" onClick={() => void post({ action: 'deleteSearch', id: s.id }, 'Search deleted.')}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </div></div>

      <p role="status">{total} file{total === 1 ? '' : 's'} found.</p>
      <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, padding: 0, margin: 0, listStyle: 'none' }}>
        {docs.map((d) => (
          <li key={d.id}>
            <a href={`/admin/content/media/${d.id}`} style={{ display: 'block' }}>
              {d.mimeType?.startsWith('image/') && d.url ? <img src={d.url} alt={d.alt ?? ''} loading="lazy" style={{ width: '100%', height: 110, objectFit: 'cover' }} /> : <span style={{ display: 'block', height: 110 }}>{d.mimeType ?? 'file'}</span>}
              <span style={{ display: 'block', fontSize: 12, overflowWrap: 'anywhere' }}>{d.filename}</span>
            </a>
            <span className="text-muted" style={{ fontSize: 11 }}>{d.status !== 'approved' ? `${d.status.replace('_', ' ')}, ` : ''}{d.width && d.height ? `${d.width} x ${d.height}` : ''}</span>
          </li>
        ))}
      </ul>
      {pages > 1 ? (
        <div className="cluster">
          <button type="button" className="btn" disabled={page <= 1} onClick={() => go(page - 1)}>Previous</button>
          <span>Page {page} of {pages}</span>
          <button type="button" className="btn" disabled={page >= pages} onClick={() => go(page + 1)}>Next</button>
        </div>
      ) : null}
    </div>
  )
}
