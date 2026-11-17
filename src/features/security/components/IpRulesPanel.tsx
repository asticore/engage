'use client'

import React, { useCallback, useEffect, useState } from 'react'

import { countryOptions } from '../countryNames'
import type { IpRule, IpRuleKind } from '../ipRules'

/** Admin screen for the IP allow and block lists. English only. */
export const IpRulesPanel: React.FC = () => {
  const [rules, setRules] = useState<IpRule[]>([])
  const [me, setMe] = useState('')
  const [country, setCountry] = useState('')
  const [mode, setMode] = useState<'off' | 'block' | 'allow'>('off')
  const [countries, setCountries] = useState('')
  const [kind, setKind] = useState<IpRuleKind>('block')
  const [entries, setEntries] = useState('')
  const [reason, setReason] = useState('')
  const [expires, setExpires] = useState('')
  const [message, setMessage] = useState('')
  const [blockMessage, setBlockMessage] = useState('')
  const [bypass, setBypass] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [importKind, setImportKind] = useState<IpRuleKind>('block')
  const [filter, setFilter] = useState('')
  const options = React.useMemo(() => countryOptions(), [])
  const picked = new Set(countries.split(/[\s,;]+/).filter(Boolean))
  const toggle = (code: string) => {
    const next = new Set(picked)
    if (next.has(code)) next.delete(code)
    else next.add(code)
    setCountries([...next].join(' '))
  }

  const load = useCallback(async () => {
    const res = await fetch('/api/admin-ip-rules')
    const data = (await res.json().catch((): null => null)) as { rules?: IpRule[]; bypass?: boolean; yourAddress?: string; yourCountry?: string; error?: string } | null
    if (!res.ok) return setMessage(data?.error ?? 'Could not load the lists.')
    const all = data?.rules ?? []
    setRules(all.filter((r) => r.kind === 'allow' || r.kind === 'block'))
    const cc = all.filter((r) => r.kind === 'country-allow' || r.kind === 'country-block')
    setMode(cc.some((r) => r.kind === 'country-allow') ? 'allow' : cc.length ? 'block' : 'off')
    setCountries(cc.map((r) => r.entry).join(' '))
    setBlockMessage(all.find((r) => r.kind === 'message')?.entry ?? '')
    setBypass(Boolean(data?.bypass))
    setMe(data?.yourAddress ?? '')
    setCountry(data?.yourCountry ?? '')
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
      <h2>Import a list</h2>
      <p>Load addresses or ranges from a text or CSV file, or from a web address (https only, up to 1 MB, one entry per line). Invalid lines are skipped and listed.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (await post({ action: 'import', kind: importKind, url: importUrl }, 'Imported.')) setImportUrl('')
        }}
        style={{ display: 'grid', gap: '0.75rem', maxWidth: '36rem' }}
      >
        <label>List<br />
          <select value={importKind} onChange={(e) => setImportKind(e.target.value === 'allow' ? 'allow' : 'block')}>
            <option value="block">Block</option>
            <option value="allow">Allow</option>
          </select>
        </label>
        <label>File<br />
          <input
            type="file"
            accept=".txt,.csv,text/plain,text/csv"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              if (file.size > 1_000_000) return setMessage('That file is larger than 1 MB.')
              await post({ action: 'import', kind: importKind, entries: await file.text() }, 'Imported.')
            }}
          />
        </label>
        <label>Or web address<br /><input type="url" value={importUrl} placeholder="https://example.com/list.txt" onChange={(e) => setImportUrl(e.target.value)} /></label>
        <button type="submit" disabled={!importUrl.trim()}>Import from address</button>
      </form>
      <h2>Admin bypass and message</h2>
      <p>
        Admin bypass: {bypass ? 'on for this browser' : 'off for this browser'}. While on (30 days), this browser skips both the IP and country lists, so a signed-in admin is never locked out.{' '}
        <button type="button" onClick={() => void post({ action: 'bypass', on: !bypass }, bypass ? 'Bypass turned off.' : 'Bypass turned on for this browser.')}>{bypass ? 'Turn off' : 'Turn on'}</button>
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          await post({ action: 'message', message: blockMessage }, 'Message saved.')
        }}
        style={{ display: 'grid', gap: '0.75rem', maxWidth: '36rem' }}
      >
        <label>Message shown to blocked visitors (plain text, up to 300 characters; empty uses the built-in text)<br />
          <textarea rows={2} maxLength={300} style={{ width: '100%' }} value={blockMessage} onChange={(e) => setBlockMessage(e.target.value)} />
        </label>
        <button type="submit">Save message</button>
      </form>
      <h2>Countries</h2>
      <p>Your country as the site sees it: <code>{country || 'unknown'}</code>. This covers the whole site: pages, admin, sign-in, checkout and the API. Addresses on the allow list above skip it. Use two letter codes such as AU or US; XX means an unknown country. You cannot block your own country.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          await post({ action: 'countries', mode: mode === 'off' ? null : mode, countries }, 'Countries saved.')
        }}
        style={{ display: 'grid', gap: '0.75rem', maxWidth: '36rem' }}
      >
        <label>Mode<br />
          <select value={mode} onChange={(e) => setMode(e.target.value === 'allow' ? 'allow' : e.target.value === 'block' ? 'block' : 'off')}>
            <option value="off">Off (every country)</option>
            <option value="block">Block these countries</option>
            <option value="allow">Only allow these countries</option>
          </select>
        </label>
        {mode !== 'off' && (
          <fieldset style={{ display: 'grid', gap: '0.5rem' }}>
            <legend>Countries ({picked.size} chosen)</legend>
            <input type="search" aria-label="Search countries" placeholder="Search by name or code" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <div style={{ maxHeight: '16rem', overflowY: 'auto', display: 'grid', gap: '0.25rem' }}>
              {options.length === 0 && <p>The country list is not available here. Type codes below.</p>}
              {options
                .filter((o) => !filter || o.name.toLowerCase().includes(filter.toLowerCase()) || o.code.toLowerCase() === filter.toLowerCase() || picked.has(o.code))
                .map((o) => (
                  <label key={o.code}><input type="checkbox" checked={picked.has(o.code)} onChange={() => toggle(o.code)} /> {o.name} ({o.code})</label>
                ))}
            </div>
            <label>Codes (filled by the list; you can also type two letter codes)<br />
              <input style={{ width: '100%' }} value={countries} onChange={(e) => setCountries(e.target.value)} />
            </label>
          </fieldset>
        )}
        <button type="submit">Save countries</button>
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
