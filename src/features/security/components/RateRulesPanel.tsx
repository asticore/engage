'use client'

import React, { useCallback, useEffect, useState } from 'react'

import { RATE_METHODS, type RateRule } from '../routeRules'

/** Admin screen for per-route rate limit rules. English only. */
export const RateRulesPanel: React.FC = () => {
  const [rules, setRules] = useState<RateRule[]>([])
  const [pathPrefix, setPathPrefix] = useState('/api/')
  const [method, setMethod] = useState('ANY')
  const [limit, setLimit] = useState('30')
  const [windowSeconds, setWindowSeconds] = useState('60')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin-rate-rules')
    const data = (await res.json().catch((): null => null)) as { rules?: RateRule[]; error?: string } | null
    if (!res.ok) return setMessage(data?.error ?? 'Could not load the rules.')
    setRules(data?.rules ?? [])
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (body: Record<string, unknown>, ok: string): Promise<boolean> => {
    const res = await fetch('/api/admin-rate-rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = (await res.json().catch((): null => null)) as { error?: string } | null
    if (!res.ok) {
      setMessage(data?.error ?? 'That did not work.')
      return false
    }
    setMessage(ok)
    await load()
    return true
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {message && <p role="status">{message}</p>}
      <p>Each rule counts requests per address to one path and everything under it. Over the limit gets a plain 429 with a Retry-After. The most specific path wins. Changes reach every server within 30 seconds.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (await post({ action: 'add', pathPrefix, method, limit, windowSeconds, note }, 'Rule saved.')) setNote('')
        }}
        style={{ display: 'grid', gap: '0.75rem', maxWidth: '36rem' }}
      >
        <label>Path (for example /api/forms or /contact)<br /><input value={pathPrefix} onChange={(e) => setPathPrefix(e.target.value)} required /></label>
        <label>Method<br />
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            {RATE_METHODS.map((m) => <option key={m} value={m}>{m === 'ANY' ? 'Any' : m}</option>)}
          </select>
        </label>
        <label>Requests allowed<br /><input inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value)} required /></label>
        <label>Per this many seconds (10 to 86400)<br /><input inputMode="numeric" value={windowSeconds} onChange={(e) => setWindowSeconds(e.target.value)} required /></label>
        <label>Note (only you see it)<br /><input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} /></label>
        <button type="submit">Add rule</button>
      </form>
      <table>
        <thead><tr><th>Path</th><th>Method</th><th>Limit</th><th>On</th><th>Note</th><th /></tr></thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id}>
              <td><code>{r.pathPrefix}</code></td>
              <td>{r.method}</td>
              <td>{r.limit} per {r.windowSeconds}s</td>
              <td><input aria-label="Enabled" checked={r.enabled} onChange={(e) => void post({ action: 'toggle', id: r.id, enabled: e.target.checked }, 'Saved.')} type="checkbox" /></td>
              <td>{r.note}</td>
              <td><button onClick={() => void post({ action: 'delete', id: r.id }, 'Deleted.')} type="button">Delete</button></td>
            </tr>
          ))}
          {rules.length === 0 && <tr><td colSpan={6}>No rules yet.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
