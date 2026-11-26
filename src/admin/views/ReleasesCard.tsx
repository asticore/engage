'use client'

import { useEffect, useState } from 'react'

import { CollapsibleCard } from '@/admin/components/CollapsibleCard'
import { RELEASE_COLLECTIONS } from '@/features/releases/core'

type Item = { collection: string; docId: number; title: string }
type Rel = { id: number; name: string; publishAt: string | null; status: 'open' | 'published' | 'undone'; note: string | null; items: Item[] }

/** Releases (Task 15, 34h6): bundle documents, publish them together now or at a time, undo. */
export function ReleasesCard() {
  const [rels, setRels] = useState<Rel[]>([])
  const [name, setName] = useState('')
  const [when, setWhen] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [add, setAdd] = useState<Record<number, { collection: string; docId: string }>>({})

  const load = async () => {
    try {
      const r = await fetch('/api/admin-releases', { cache: 'no-store' })
      if (r.ok) setRels(((await r.json()) as { releases: Rel[] }).releases)
    } catch {
      setMsg('Could not load releases.')
    }
  }
  useEffect(() => { void load() }, [])

  const post = async (payload: Record<string, unknown>) => {
    setBusy(true)
    setMsg('')
    try {
      const r = await fetch('/api/admin-releases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const d = (await r.json()) as { ok?: boolean; message?: string; count?: number }
      setMsg(d.ok ? (payload.action === 'publish' ? `Published ${d.count ?? 0} item(s).` : payload.action === 'undo' ? 'Undone.' : 'Saved.') : d.message ?? 'That did not work.')
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <CollapsibleCard id="scheduled-tasks-releases" title="Releases">
      <p className="sh-muted">Group pages, posts, events, courses and products into one release. It publishes them all together, now or at the time you set, and can be undone.</p>
      {rels.map((r) => {
        const a = add[r.id] ?? { collection: 'pages', docId: '' }
        return (
          <div key={r.id} className="sh-release">
            <p><strong>{r.name}</strong> ({r.status}{r.publishAt ? `, ${r.status === 'open' ? 'goes live' : 'was set for'} ${r.publishAt.slice(0, 16).replace('T', ' ')} UTC` : ''})</p>
            {r.note ? <p className="sh-error">{r.note}</p> : null}
            <ul>
              {r.items.map((i) => (
                <li key={`${i.collection}-${i.docId}`}>{i.title} <span className="sh-muted">({i.collection} {i.docId})</span>{' '}
                  {r.status === 'open' ? <button type="button" disabled={busy} onClick={() => post({ action: 'remove', id: r.id, collection: i.collection, docId: i.docId })}>Remove</button> : null}
                </li>
              ))}
            </ul>
            {r.status === 'open' ? (
              <p>
                <select aria-label="Type" value={a.collection} onChange={(e) => setAdd({ ...add, [r.id]: { ...a, collection: e.target.value } })}>
                  {RELEASE_COLLECTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>{' '}
                <input aria-label="Document id" placeholder="Document id" value={a.docId} onChange={(e) => setAdd({ ...add, [r.id]: { ...a, docId: e.target.value } })} size={8} />{' '}
                <button type="button" disabled={busy || !a.docId} onClick={() => post({ action: 'add', id: r.id, collection: a.collection, docId: a.docId })}>Add</button>{' '}
                <button type="button" disabled={busy || r.items.length === 0} onClick={() => post({ action: 'publish', id: r.id })}>Publish now</button>
              </p>
            ) : null}
            {r.status === 'published' ? <button type="button" disabled={busy} onClick={() => post({ action: 'undo', id: r.id })}>Undo release</button> : null}{' '}
            <button type="button" disabled={busy} onClick={() => post({ action: 'delete', id: r.id })}>Delete</button>
          </div>
        )
      })}
      <p>
        <input aria-label="Release name" placeholder="Release name" value={name} onChange={(e) => setName(e.target.value)} />{' '}
        <input aria-label="Goes live at (UTC)" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />{' '}
        <button type="button" disabled={busy || !name.trim()} onClick={() => post({ action: 'create', name, publishAt: when ? `${when}:00Z` : '' }).then(() => { setName(''); setWhen('') })}>New release</button>
      </p>
      <p className="sh-muted">The time is in UTC. Leave it empty to publish by hand.</p>
      {msg ? <p role="status" className="sh-muted">{msg}</p> : null}
    </CollapsibleCard>
  )
}
