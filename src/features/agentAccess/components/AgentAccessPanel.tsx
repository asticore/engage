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
type Pending = { userCode: string; clientName: string; scope: 'read' | 'write'; expiresAt: number }
type Loaded = { pendingDevices: Pending[]; apiKeysOn: boolean; maxLifetimeDays: number; collections: Array<{ slug: string; label: string }>; grants: GrantView[]; actions: AgentAction[] }

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
  const [deviceCode, setDeviceCode] = useState('')
  const [devicePassword, setDevicePassword] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin-agents${grantFilter ? `?grant=${grantFilter}` : ''}`)
    const out = (await res.json().catch((): null => null)) as (Loaded & { error?: string }) | null
    if (!res.ok || !out) return setMessage(out?.error ?? 'Could not load agent access.')
    setData(out)
  }, [grantFilter])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('code')
    if (q) setDeviceCode(q)
  }, [])

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

      <h2>Approve a device code</h2>
      <p>When an AI tool or command line asks to connect, it shows a code like BCDF-GHJK. Approve it here and the tool receives its own token. It gets the access it asked for (read only unless it asked to write) with the default caps.</p>
      {data.pendingDevices.map((d) => (
        <p key={d.userCode}>
          <strong>{d.userCode}</strong> from {d.clientName}, wants {d.scope === 'write' ? 'read and write' : 'read only'}.{' '}
          <button type="button" onClick={() => setDeviceCode(d.userCode)}>
            Use this code
          </button>
        </p>
      ))}
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (await post({ action: 'device-approve', userCode: deviceCode, password: devicePassword, dailyWriteCap: form.dailyWriteCap, dailyReadCap: form.dailyReadCap, expiresInDays: form.expiresInDays ? Number(form.expiresInDays) : undefined }, 'Approved. The tool collects its token in a moment.')) {
            setDeviceCode('')
            setDevicePassword('')
          }
        }}
      >
        <label style={{ display: 'block', marginBottom: 8 }}>
          Code
          <input value={deviceCode} onChange={(e) => setDeviceCode(e.target.value)} style={{ display: 'block' }} autoComplete="off" />
        </label>
        <label style={{ display: 'block', marginBottom: 8 }}>
          Your password, to confirm
          <input type="password" value={devicePassword} onChange={(e) => setDevicePassword(e.target.value)} style={{ display: 'block' }} />
        </label>
        <button type="submit" disabled={!data.apiKeysOn}>
          Approve
        </button>{' '}
        <button type="button" onClick={() => void post({ action: 'device-deny', userCode: deviceCode }, 'Denied.')}>
          Deny
        </button>
      </form>

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
