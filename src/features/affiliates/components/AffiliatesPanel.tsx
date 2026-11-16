'use client'

import React, { useCallback, useEffect, useState } from 'react'

import type { Affiliate } from '../store'

/** Admin list of affiliates: add one, approve or suspend, copy the link, delete. English only. */
export const AffiliatesPanel: React.FC<{ origin: string }> = ({ origin }) => {
  const [rows, setRows] = useState<Affiliate[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin-affiliates')
    const data = (await res.json().catch((): null => null)) as { affiliates?: Affiliate[]; error?: string } | null
    if (!res.ok) return setMessage(data?.error ?? 'Could not load affiliates.')
    setRows(data?.affiliates ?? [])
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (body: Record<string, unknown>): Promise<boolean> => {
    const res = await fetch('/api/admin-affiliates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = (await res.json().catch((): null => null)) as { error?: string } | null
    if (!res.ok) {
      setMessage(data?.error ?? 'That did not work.')
      return false
    }
    setMessage('')
    await load()
    return true
  }

  const link = (c: string): string => `${origin.replace(/\/+$/, '')}/?ref=${encodeURIComponent(c)}`

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (await post({ action: 'create', name, email, code })) {
            setName('')
            setEmail('')
            setCode('')
          }
        }}
        style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'end' }}
      >
        <label>Name<br /><input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} /></label>
        <label>Email (optional)<br /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} /></label>
        <label>Code (optional)<br /><input value={code} onChange={(e) => setCode(e.target.value)} maxLength={32} placeholder="made for you" /></label>
        <button type="submit">Add affiliate</button>
      </form>
      {message && <p role="alert">{message}</p>}
      {rows.length === 0 ? (
        <p>No affiliates yet. Add one, then share their link.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Link</th>
              <th scope="col">Status</th>
              <th scope="col">Visits</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <th scope="row">{a.name}{a.email ? <small> ({a.email})</small> : null}</th>
                <td><code>{link(a.code)}</code></td>
                <td>{a.status}</td>
                <td>{a.visits}</td>
                <td style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {a.status !== 'active' && <button type="button" onClick={() => post({ action: 'status', id: a.id, status: 'active' })}>Approve</button>}
                  {a.status === 'active' && <button type="button" onClick={() => post({ action: 'status', id: a.id, status: 'suspended' })}>Suspend</button>}
                  <button type="button" onClick={() => navigator.clipboard?.writeText(link(a.code)).then(() => setMessage('Link copied.')).catch((): void => undefined)}>Copy link</button>
                  <button type="button" onClick={() => { if (window.confirm(`Delete ${a.name} and their visit log?`)) void post({ action: 'delete', id: a.id }) }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
