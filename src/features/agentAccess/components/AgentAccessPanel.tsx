'use client'

import React, { useCallback, useEffect, useState } from 'react'

import type { AgentAction } from '../core'

type GrantView = {
  id: number
  label: string
  tool: string
  caps: string
  dailyWriteCap: number
  dailyReadCap: number
  prefix: string
  scopes: string[]
  expiresAt: string | null
  lastUsedAt: string | null
  revokedAt: string | null
  keyRevoked: boolean
  usedToday: { reads: number; writes: number }
}
type Loaded = { apiKeysOn: boolean; maxLifetimeDays: number; collections: Array<{ slug: string; label: string }>; grants: GrantView[]; actions: AgentAction[] }

const when = (iso: string | null): string => (iso ? iso.replace('T', ' ').slice(0, 16) : 'never')

/** Admin screen for AI agent access: make a scoped token for a connected AI tool, cap what it can do each day, read its log, revoke it. English only. */
export const AgentAccessPanel: React.FC = () => {
  const [data, setData] = useState<Loaded | null>(null)
  const [message, setMessage] = useState('')
  const [secret, setSecret] = useState('')
  const [pick, setPick] = useState<string[]>([])
  const [mode, setMode] = useState<'read' | 'write'>('read')
  const [form, setForm] = useState({ label: '', tool: '', dailyWriteCap: '200', dailyReadCap: '5000', expiresInDays: '30', password: '' })
  const [grantFilter, setGrantFilter] = useState(0)

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin-agents${grantFilter ? `?grant=${grantFilter}` : ''}`)
    const out = (await res.json().catch((): null => null)) as (Loaded & { error?: string }) | null
    if (!res.ok || !out) return setMessage(out?.error ?? 'Could not load agent access.')
    setData(out)
  }, [grantFilter])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (body: Record<string, unknown>, ok = ''): Promise<{ ok: boolean; key?: string }> => {
    const res = await fetch('/api/admin-agents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const out = (await res.json().catch((): null => null)) as { error?: string; key?: string; removed?: number } | null
    if (!res.ok) {
      setMessage(out?.error ?? 'That did not work.')
      return { ok: false }
    }
    setMessage(typeof out?.removed === 'number' ? `Removed ${out.removed} old log rows.` : ok)
    await load()
    return { ok: true, key: out?.key }
  }

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    setSecret('')
    const scopes = pick.length === 0 ? [mode === 'read' ? '*:read' : '*:*'] : pick.flatMap((slug) => (mode === 'read' ? [`${slug}:read`] : [`${slug}:read`, `${slug}:write`]))
    const result = await post({ action: 'create', ...form, scopes, expiresInDays: form.expiresInDays ? Number(form.expiresInDays) : undefined }, 'Token created. Copy it now; it is not shown again.')
    if (result.ok && result.key) {
      setSecret(result.key)
      setForm((f) => ({ ...f, label: '', tool: '', password: '' }))
    }
  }

  if (!data) return <p>{message || 'Loading...'}</p>
  const field = (key: keyof typeof form, label: string, type = 'text') => (
    <label style={{ display: 'block', marginBottom: 8 }}>
      {label}
      <input type={type} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} style={{ display: 'block', width: '100%', maxWidth: 360 }} />
    </label>
  )

  return (
    <div>
      {message ? <p role="status">{message}</p> : null}
      {!data.apiKeysOn ? <p>API keys are switched off. Switch them on in Security settings before you make an agent token.</p> : null}

      <h2>New agent token</h2>
      <form onSubmit={create}>
        {field('label', 'Agent name (for example "Claude desktop")')}
        {field('tool', 'Tool or app (optional)')}
        <fieldset style={{ marginBottom: 8 }}>
          <legend>What it may do</legend>
          <label>
            <input type="radio" checked={mode === 'read'} onChange={() => setMode('read')} /> Read only
          </label>{' '}
          <label>
            <input type="radio" checked={mode === 'write'} onChange={() => setMode('write')} /> Read and write (never delete)
          </label>
        </fieldset>
        <fieldset style={{ marginBottom: 8 }}>
          <legend>Which content (none ticked means all of it)</legend>
          {data.collections.map((c) => (
            <label key={c.slug} style={{ display: 'inline-block', marginRight: 12 }}>
              <input type="checkbox" checked={pick.includes(c.slug)} onChange={(e) => setPick((p) => (e.target.checked ? [...p, c.slug] : p.filter((x) => x !== c.slug)))} /> {c.label}
            </label>
          ))}
        </fieldset>
        {field('dailyWriteCap', 'Writes allowed per day (0 for no cap)', 'number')}
        {field('dailyReadCap', 'Reads allowed per day (0 for no cap)', 'number')}
        {field('expiresInDays', `Expires after how many days (up to ${data.maxLifetimeDays || 'no limit'})`, 'number')}
        {field('password', 'Your password, to confirm', 'password')}
        <button type="submit" disabled={!data.apiKeysOn}>
          Create token
        </button>
      </form>
      {secret ? (
        <p>
          <strong>Token (shown once):</strong> <code>{secret}</code>
          <br />
          Give it to the AI tool as a bearer token: <code>Authorization: Bearer {'<token>'}</code>
        </p>
      ) : null}

      <h2>Agent tokens</h2>
      {data.grants.length === 0 ? <p>No agent tokens yet.</p> : null}
      <table>
        <thead>
          <tr>
            <th scope="col">Agent</th>
            <th scope="col">Access</th>
            <th scope="col">Today</th>
            <th scope="col">Caps</th>
            <th scope="col">Last used</th>
            <th scope="col">Status</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.grants.map((g) => (
            <tr key={g.id}>
              <th scope="row">
                {g.label}
                {g.tool ? ` (${g.tool})` : ''}
                <br />
                <code>{g.prefix}...</code>
              </th>
              <td>{g.scopes.join(', ')}</td>
              <td>
                {g.usedToday.writes} writes, {g.usedToday.reads} reads
              </td>
              <td>{g.caps}</td>
              <td>{when(g.lastUsedAt)}</td>
              <td>{g.revokedAt || g.keyRevoked ? 'Revoked' : g.expiresAt && Date.parse(g.expiresAt) < Date.now() ? 'Expired' : 'Active'}</td>
              <td>
                <button type="button" onClick={() => setGrantFilter(grantFilter === g.id ? 0 : g.id)}>
                  {grantFilter === g.id ? 'All activity' : 'Its activity'}
                </button>{' '}
                {!g.revokedAt ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const w = window.prompt('Writes per day (0 for no cap)', String(g.dailyWriteCap))
                        const r = w === null ? null : window.prompt('Reads per day (0 for no cap)', String(g.dailyReadCap))
                        if (w !== null && r !== null) void post({ action: 'caps', id: g.id, dailyWriteCap: w, dailyReadCap: r }, 'Caps saved.')
                      }}
                    >
                      Change caps
                    </button>{' '}
                    <button type="button" onClick={() => void post({ action: 'revoke', id: g.id }, 'Token revoked. It stops working at once.')}>
                      Revoke
                    </button>
                  </>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Activity</h2>
      <p>Every request an agent makes, newest first. Requests over a cap are shown as capped and are not counted.</p>
      <table>
        <thead>
          <tr>
            <th scope="col">Time (UTC)</th>
            <th scope="col">Agent</th>
            <th scope="col">Request</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {data.actions.map((a) => (
            <tr key={a.id}>
              <td>{when(a.at)}</td>
              <td>{data.grants.find((g) => g.id === a.grantId)?.label ?? `#${a.grantId}`}</td>
              <td>
                {a.method} /{a.path}
              </td>
              <td>{a.outcome}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={() => void post({ action: 'purge' })}>
        Delete log rows older than 90 days
      </button>
    </div>
  )
}
