'use client'

import React, { useCallback, useEffect, useState } from 'react'

import type { FranchiseStatus, LockChoice } from '../core'

type Row = { id: number; name: string; host: string; ownerEmail: string; status: FranchiseStatus; pages: number; lastRolledAt: string | null }
type Loaded = {
  franchises: Row[]
  rollup: { franchises: number; active: number; pages: number }
  templates: { id: number; name: string }[]
  lockChoices: { value: LockChoice; label: string }[]
}

/** Admin screen for franchising: franchises, roll-out of shared templates, and the roll-up. English only. */
export const FranchisingPanel: React.FC = () => {
  const [data, setData] = useState<Loaded | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [host, setHost] = useState('')
  const [owner, setOwner] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [lock, setLock] = useState<LockChoice>('structure')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin-franchises')
    const out = (await res.json().catch((): null => null)) as (Loaded & { error?: string }) | null
    if (!res.ok || !out) return setMessage(out?.error ?? 'Could not load the franchises.')
    setData(out)
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (body: Record<string, unknown>, ok: string): Promise<Record<string, unknown> | null> => {
    setBusy(true)
    const res = await fetch('/api/admin-franchises', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const out = (await res.json().catch((): null => null)) as Record<string, unknown> | null
    setBusy(false)
    setMessage(String((res.ok || res.status === 207 ? out?.message : out?.error) ?? (res.ok ? ok : 'That did not work.')))
    if (res.ok || res.status === 207) await load()
    return res.ok || res.status === 207 ? (out ?? {}) : null
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {message && <p role="status">{message}</p>}

      {data && <p>{data.rollup.franchises} franchise(s), {data.rollup.active} active, {data.rollup.pages} rolled-out page(s) in total.</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void post({ action: 'create', name, host, ownerEmail: owner }, 'Franchise added.').then((out) => {
            if (out) {
              setName('')
              setHost('')
              setOwner('')
            }
          })
        }}
        style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}
      >
        <label>Franchise name<br /><input type="text" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Domain (such as bondi.example.com)<br /><input type="text" required value={host} onChange={(e) => setHost(e.target.value)} /></label>
        <label>Owner email (optional)<br /><input type="email" value={owner} onChange={(e) => setOwner(e.target.value)} /></label>
        <button type="submit" disabled={busy}>Add franchise</button>
      </form>

      {data && data.franchises.length === 0 && <p>No franchises yet.</p>}
      {data && data.franchises.length > 0 && (
        <table>
          <thead>
            <tr><th scope="col">Franchise</th><th scope="col">Domain</th><th scope="col">Owner</th><th scope="col">Status</th><th scope="col">Rolled-out pages</th><th scope="col">Actions</th></tr>
          </thead>
          <tbody>
            {data.franchises.map((f) => (
              <tr key={f.id}>
                <td>{f.name}</td>
                <td>{f.host}</td>
                <td>{f.ownerEmail || 'None'}</td>
                <td>{f.status === 'active' ? 'Active' : 'Paused'}</td>
                <td>{f.pages}{f.lastRolledAt ? ` (last ${new Date(f.lastRolledAt).toLocaleDateString()})` : ''}</td>
                <td style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" disabled={busy} onClick={() => void post({ action: 'update', id: f.id, name: f.name, ownerEmail: f.ownerEmail, status: f.status === 'active' ? 'paused' : 'active' }, 'Saved.')}>{f.status === 'active' ? 'Pause' : 'Resume'}</button>
                  <button
                    type="button"
                    disabled={busy || !f.ownerEmail}
                    onClick={() => void post({ action: 'owner', id: f.id }, '').then((out) => out?.password && setMessage(`Owner account created for ${f.ownerEmail}. One-time password: ${String(out.password)} (copy it now, it is not shown again).`))}
                  >
                    Create owner account
                  </button>
                  <button type="button" disabled={busy} onClick={() => void post({ action: 'delete', id: f.id }, 'Removed.')}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <section aria-labelledby="fr-rollout">
        <h2 id="fr-rollout">Roll out a shared template</h2>
        <p>Makes (or updates) one page per active franchise from a page template. Each page shows only on its franchise domain. Rolling out again replaces the page content, so head-office changes reach everyone.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void post({ action: 'rollout', templateId: Number(templateId), lock }, 'Rolled out.')
          }}
          style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}
        >
          <label>Template<br />
            <select required value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">Choose a template</option>
              {(data?.templates ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label>Lock<br />
            <select value={lock} onChange={(e) => setLock(e.target.value as LockChoice)}>
              {(data?.lockChoices ?? []).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <button type="submit" disabled={busy || !templateId}>Roll out</button>
        </form>
      </section>
    </div>
  )
}
