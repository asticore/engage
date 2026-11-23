'use client'

import React, { useEffect, useState } from 'react'

import { itemsToText, type Datasource } from '@/features/datasources/core'

/** Shared option lists (Task 15, 34h5): edit a list once, every form field that names it follows. */
export const SharedListsCard: React.FC = () => {
  const [lists, setLists] = useState<Datasource[]>([])
  const [slug, setSlug] = useState('')
  const [label, setLabel] = useState('')
  const [text, setText] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      const r = await fetch('/api/admin-datasources', { cache: 'no-store' })
      if (r.ok) setLists(((await r.json()) as { lists: Datasource[] }).lists)
    } catch {
      setMsg('Could not load the lists.')
    }
  }
  useEffect(() => { void load() }, [])

  const post = async (payload: Record<string, unknown>) => {
    setBusy(true)
    setMsg('')
    try {
      const r = await fetch('/api/admin-datasources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const d = (await r.json()) as { ok?: boolean; message?: string }
      setMsg(d.ok ? 'Saved.' : d.message ?? 'Could not save.')
      if (d.ok) await load()
    } finally {
      setBusy(false)
    }
  }

  const edit = (l: Datasource) => { setSlug(l.slug); setLabel(l.label); setText(itemsToText(l.items)) }

  return (
    <div className="ve-shared-lists">
      <p className="ve-panel__hint">Lists you can reuse. In a Dropdown, Radio or Checkbox field, type the list name under Shared list.</p>
      {lists.map((l) => (
        <p key={l.slug} className="ve-panel__hint">
          <strong>{l.slug}</strong> ({l.items.length} choices){' '}
          <button type="button" className="ve-btn ve-btn--ghost" onClick={() => edit(l)}>Edit</button>{' '}
          <button type="button" className="ve-btn ve-btn--ghost" disabled={busy} onClick={() => post({ action: 'delete', slug: l.slug })}>Delete</button>
        </p>
      ))}
      <input type="text" aria-label="List name" placeholder="List name, e.g. sizes" value={slug} onChange={(e) => setSlug(e.target.value)} />
      <input type="text" aria-label="List title" placeholder="Title (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
      <textarea aria-label="Choices" rows={5} placeholder={'One per line: Label | value\nSmall | s'} value={text} onChange={(e) => setText(e.target.value)} />
      <button type="button" className="ve-btn ve-btn--ghost" disabled={busy || !slug.trim()} onClick={() => post({ action: 'save', slug, label, text })}>Save list</button>
      {msg ? <p role="status" className="ve-panel__hint">{msg}</p> : null}
    </div>
  )
}
