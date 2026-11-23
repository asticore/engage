'use client'

import React, { useState } from 'react'

import { templateButtonClass } from '@/features/siteTemplates/admin/NewTemplate'

type Placed = { kind: string; label: string; editorUrl: string; created: boolean; replaced: boolean; already: boolean }
type Result = { loop: { editorUrl: string }; placed: Placed[] }

const panel = 'rounded-[6px] border border-[var(--theme-elevation-150,#cac7d1)] p-[12px]'

/**
 * New loop (Task 14, 33f): name it, say what fills it (posts, products or events) and the filter, sort and count, then
 * choose the archives it goes on. The card is made for the source and a Loop grid with this query is placed on each
 * chosen archive. The same loop can sit on the blog and the shop archive with different settings by running this twice.
 */
export const NewLoop: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [form, setForm] = useState({ name: '', source: 'posts', category: '', tag: '', author: '', orderBy: 'newest', count: 9, columns: 3 })
  const [blog, setBlog] = useState(true)
  const [shop, setShop] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const set = (key: string, value: string | number) => setForm((f) => ({ ...f, [key]: value }))

  const create = async () => {
    setBusy(true)
    setError('')
    try {
      const placeOn = [blog ? 'archive-blog' : '', shop ? 'archive-shop' : ''].filter(Boolean)
      const res = await fetch('/api/admin-loops', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, placeOn }) })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string } & Partial<Result>
      if (!res.ok || json.ok === false || !json.loop) throw new Error(json.error || 'Could not create the loop.')
      setResult({ loop: json.loop, placed: json.placed ?? [] })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the loop.')
    }
    setBusy(false)
  }

  const field = (label: string, node: React.ReactNode) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>{label}{node}</label>
  )

  return (
    <section aria-label="New loop" className={panel} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 620 }}>
      <strong>New loop</strong>
      {field('Name', <input value={form.name} onChange={(e) => set('name', e.target.value)} style={{ maxWidth: 280 }} />)}
      {field('What fills it', (
        <select value={form.source} onChange={(e) => set('source', e.target.value)} style={{ maxWidth: 280 }}>
          <option value="posts">Blog posts</option><option value="products">Products</option><option value="events">Events</option>
        </select>
      ))}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {field('Category (optional)', <input value={form.category} onChange={(e) => set('category', e.target.value)} />)}
        {form.source === 'posts' ? field('Tag (optional)', <input value={form.tag} onChange={(e) => set('tag', e.target.value)} />) : null}
        {form.source === 'posts' ? field('Author (optional)', <input value={form.author} onChange={(e) => set('author', e.target.value)} />) : null}
        {field('Sort', (
          <select value={form.orderBy} onChange={(e) => set('orderBy', e.target.value)}>
            <option value="newest">Newest</option><option value="oldest">Oldest</option><option value="title">Title A to Z</option>
            {form.source === 'products' ? <><option value="price-asc">Price low to high</option><option value="price-desc">Price high to low</option></> : null}
          </select>
        ))}
        {field('Count per page', <input type="number" min={1} max={48} value={form.count} onChange={(e) => set('count', Number(e.target.value))} style={{ width: 90 }} />)}
        {field('Columns', <input type="number" min={1} max={4} value={form.columns} onChange={(e) => set('columns', Number(e.target.value))} style={{ width: 70 }} />)}
      </div>
      <fieldset style={{ border: 0, padding: 0, margin: 0, fontSize: 13 }}>
        <legend>Place on</legend>
        <label><input type="checkbox" checked={blog} onChange={(e) => setBlog(e.target.checked)} /> Blog archive</label>{' '}
        <label><input type="checkbox" checked={shop} onChange={(e) => setShop(e.target.checked)} /> Shop archive</label>
        <p style={{ margin: '4px 0 0' }}>On an archive that already has a template, the plain list is replaced by this loop. Where none exists, a switched-off draft is made.</p>
      </fieldset>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" className={templateButtonClass} disabled={busy || !form.name.trim()} onClick={() => void create()}>{busy ? 'Creating...' : 'Create loop'}</button>
        <button type="button" className={templateButtonClass} onClick={onClose}>{result ? 'Close' : 'Cancel'}</button>
      </div>
      {error ? <p role="alert" style={{ color: '#b91c1c', margin: 0, fontSize: 13 }}>{error}</p> : null}
      {result ? (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
          <li>Loop card created. <a href={result.loop.editorUrl}>Edit the card</a></li>
          {result.placed.map((p) => (
            <li key={p.kind}>{p.already ? `Already on the ${p.label}.` : p.created ? `New ${p.label} draft made (switched off).` : `Placed on the ${p.label}.`} <a href={p.editorUrl}>Open it</a></li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

export default NewLoop
