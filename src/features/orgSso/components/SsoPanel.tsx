'use client'

import React, { useCallback, useEffect, useState } from 'react'

type Rec = { domain: string; verified: boolean; name: string; value: string }
type Conn = {
  id: string
  orgId: string
  name: string
  issuer: string
  clientId: string
  hasSecret: boolean
  defaultRole: string
  jit: boolean
  enforce: boolean
  enabled: boolean
  records: Rec[]
}
type Loaded = { redirectUri: string; orgs: Array<{ id: string; name: string }>; connections: Conn[] }

const blank = { id: '', orgId: '', name: '', issuer: '', clientId: '', clientSecret: '', defaultRole: 'member', jit: true, enforce: false, enabled: false }

/** Admin screen for single sign-on: one connection per organisation, its domains and the DNS proof, enforcement. English only. */
export const SsoPanel: React.FC = () => {
  const [data, setData] = useState<Loaded | null>(null)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState(blank)
  const [domain, setDomain] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const res = await fetch('/api/admin-sso')
    const out = (await res.json().catch((): null => null)) as (Loaded & { error?: string }) | null
    if (!res.ok || !out) return setMessage(out?.error ?? 'Could not load single sign-on.')
    setData(out)
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (body: Record<string, unknown>, ok = ''): Promise<boolean> => {
    const res = await fetch('/api/admin-sso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const out = (await res.json().catch((): null => null)) as { error?: string } | null
    setMessage(res.ok ? ok : (out?.error ?? 'That did not work.'))
    if (res.ok) await load()
    return res.ok
  }

  if (!data) return <p>{message || 'Loading...'}</p>
  const edit = (c: Conn) => setForm({ id: c.id, orgId: c.orgId, name: c.name, issuer: c.issuer, clientId: c.clientId, clientSecret: '', defaultRole: c.defaultRole, jit: c.jit, enforce: c.enforce, enabled: c.enabled })
  const text = (key: 'name' | 'issuer' | 'clientId' | 'clientSecret', label: string, type = 'text') => (
    <label style={{ display: 'block', marginBottom: 8 }}>
      {label}
      <input type={type} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} style={{ display: 'block', width: '100%', maxWidth: 420 }} />
    </label>
  )

  return (
    <div>
      {message ? <p role="status">{message}</p> : null}
      <p>
        Give your identity provider this redirect address: <code>{data.redirectUri}</code>
      </p>
      <p>
        People sign in at <code>/api/sso/start</code> with their work email.
      </p>

      <h2>{form.id ? 'Edit connection' : 'New connection'}</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (await post({ action: 'save', ...form }, 'Saved.')) setForm(blank)
        }}
      >
        <label style={{ display: 'block', marginBottom: 8 }}>
          Organisation
          <select value={form.orgId} onChange={(e) => setForm((f) => ({ ...f, orgId: e.target.value }))} disabled={Boolean(form.id)} style={{ display: 'block' }}>
            <option value="">Choose...</option>
            {data.orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        {text('name', 'Connection name (shown in the activity log)')}
        {text('issuer', 'Issuer address (for example https://login.example.com)')}
        {text('clientId', 'Client ID')}
        {text('clientSecret', form.id ? 'Client secret (leave empty to keep the saved one)' : 'Client secret', 'password')}
        <label style={{ display: 'block', marginBottom: 8 }}>
          Role for new members{' '}
          <select value={form.defaultRole} onChange={(e) => setForm((f) => ({ ...f, defaultRole: e.target.value }))}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label style={{ display: 'block' }}>
          <input type="checkbox" checked={form.jit} onChange={(e) => setForm((f) => ({ ...f, jit: e.target.checked }))} /> Create an account on first sign-in
        </label>
        <label style={{ display: 'block' }}>
          <input type="checkbox" checked={form.enforce} onChange={(e) => setForm((f) => ({ ...f, enforce: e.target.checked }))} /> Require single sign-on for verified domains (no password sign-in; staff accounts are never locked out)
        </label>
        <label style={{ display: 'block', marginBottom: 8 }}>
          <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} /> On
        </label>
        <button type="submit">Save</button> {form.id ? <button type="button" onClick={() => setForm(blank)}>Cancel</button> : null}
      </form>

      <h2>Connections</h2>
      {data.connections.length === 0 ? <p>No connections yet.</p> : null}
      {data.connections.map((c) => (
        <section key={c.id} style={{ marginBottom: 24 }}>
          <h3>
            {c.name} ({data.orgs.find((o) => o.id === c.orgId)?.name ?? 'organisation'}) {c.enabled ? '- on' : '- off'}
            {c.enforce ? ', enforced' : ''}
          </h3>
          <p>
            {c.issuer} <button type="button" onClick={() => edit(c)}>Edit</button>{' '}
            <button type="button" onClick={() => void post({ action: 'delete', id: c.id }, 'Deleted.')}>Delete</button>
          </p>
          <table>
            <thead>
              <tr>
                <th scope="col">Domain</th>
                <th scope="col">Status</th>
                <th scope="col">DNS record to add</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {c.records.map((r) => (
                <tr key={r.domain}>
                  <th scope="row">{r.domain}</th>
                  <td>{r.verified ? 'Verified' : 'Not verified'}</td>
                  <td>
                    {r.verified ? '' : (
                      <>
                        TXT <code>{r.name}</code> = <code>{r.value}</code>
                      </>
                    )}
                  </td>
                  <td>
                    {!r.verified ? <button type="button" onClick={() => void post({ action: 'verify-domain', id: c.id, domain: r.domain }, 'Domain verified.')}>Check now</button> : null}{' '}
                    <button type="button" onClick={() => void post({ action: 'remove-domain', id: c.id, domain: r.domain }, 'Removed.')}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <label>
            Add a domain{' '}
            <input value={domain[c.id] ?? ''} onChange={(e) => setDomain((d) => ({ ...d, [c.id]: e.target.value }))} placeholder="example.com" />
          </label>{' '}
          <button type="button" onClick={async () => { if (await post({ action: 'add-domain', id: c.id, domain: domain[c.id] ?? '' }, 'Domain added. Publish the DNS record, then check it.')) setDomain((d) => ({ ...d, [c.id]: '' })) }}>
            Add
          </button>
        </section>
      ))}
    </div>
  )
}
