'use client'

import React, { useCallback, useEffect, useState } from 'react'

import type { IpRule, IpRuleKind } from '../ipRules'

/** Admin screen for the IP allow and block lists. English only. */
export const IpRulesPanel: React.FC = () => {
  const [rules, setRules] = useState<IpRule[]>([])
  const [me, setMe] = useState('')
  const [kind, setKind] = useState<IpRuleKind>('block')
  const [entries, setEntries] = useState('')
  const [reason, setReason] = useState('')
  const [expires, setExpires] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin-ip-rules')
    const data = (await res.json().catch((): null => null)) as { rules?: IpRule[]; yourAddress?: string; error?: string } | null
    if (!res.ok) return setMessage(data?.error ?? 'Could not load the lists.')
    setRules(data?.rules ?? [])
    setMe(data?.yourAddress ?? '')
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (body: Record<string, unknown>, ok: string): Promise<boolean> => {
    const res = await fetch('/api/admin-ip-rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = (await res.json().catch((): null => null)) as { error?: string; rejected?: string[] } | null
    if (!res.ok) {
      setMessage(data?.error ?? 'That did not work.')
      return false
    }
    setMessage(data?.rejected?.length ? `${ok} Skipped: ${data.rejected.join(', ')}` : ok)
    await load()
    return true
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {message && <p role="status">{message}</p>}
      <p>Your address as the site sees it: <code>{me || 'unknown'}</code>. Allowed addresses are never blocked. A blocked address gets a plain 403 before any page loads. Changes reach every server within 30 seconds.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (await post({ action: 'add', kind, entries, reason, expiresAt: expires ? `${expires}T23:59:59Z` : null }, 'Saved.')) {
            setEntries('')
            setReason('')
          }
        }}
        style={{ display: 'grid', gap: '0.75rem', maxWidth: '36rem' }}
      >
        <label>List<br />
          <select value={kind} onChange={(e) => setKind(e.target.value === 'allow' ? 'allow' : 'block')}>
            <option value="block">Block</option>
            <option value="allow">Allow</option>
          </select>
        </label>
        <label>Addresses or ranges, one per line (for example 203.0.113.7 or 203.0.113.0/24)<br />
          <textarea rows={5} style={{ width: '100%' }} value={entries} onChange={(e) => setEntries(e.target.value)} required />
        </label>
        <label>Reason (only you see it)<br /><input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} /></label>
        <label>Expires on (optional)<br /><input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></label>
        <button type="submit">Add</button>
      </form>
      <p><a href="/api/admin-ip-rules?format=csv">Download the lists as CSV</a></p>
      {rules.length === 0 ? (
        <p>No entries yet.</p>
      ) : (
        <table>
          <thead>
            <tr><th scope="col">List</th><th scope="col">Address or range</th><th scope="col">Reason</th><th scope="col">Expires</th><th scope="col"><span className="visually-hidden">Remove</span></th></tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>{r.kind}</td>
                <td><code>{r.entry}</code></td>
                <td>{r.reason}</td>
                <td>{r.expiresAt ? r.expiresAt.slice(0, 10) : 'never'}</td>
                <td><button type="button" onClick={() => void post({ action: 'delete', ids: [r.id] }, 'Removed.')}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
