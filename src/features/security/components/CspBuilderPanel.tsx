'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

import {
  addSource,
  applyBuilder,
  builderPolicyText,
  builderWarnings,
  EMPTY_CSP_BUILDER,
  KEYWORD_SOURCES,
  KNOWN_HOSTS,
  PICKER_DIRECTIVES,
  validateBuilder,
  type CspBuilderConfig,
  type CspMode,
} from '../cspBuilder'

type Row = { id: number; directive: string; blocked: string; page: string; disposition: string; hits: number; lastSeen: string; suggestion: { directive: string; source: string } | null }

/** Admin screen for the guided Content-Security-Policy builder. English only. */
export const CspBuilderPanel: React.FC = () => {
  const [config, setConfig] = useState<CspBuilderConfig>(EMPTY_CSP_BUILDER)
  const [rows, setRows] = useState<Row[]>([])
  const [message, setMessage] = useState('')
  const [typed, setTyped] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)
  const [defaultPolicy, setDefaultPolicy] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin-csp')
    const data = (await res.json().catch((): null => null)) as { config?: CspBuilderConfig; violations?: Row[]; defaultPolicy?: string; error?: string } | null
    if (!res.ok) return setMessage(data?.error ?? 'Could not load the builder.')
    setConfig(data?.config ?? EMPTY_CSP_BUILDER)
    setRows(data?.violations ?? [])
    setDefaultPolicy(data?.defaultPolicy ?? '')
    setLoaded(true)
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (body: Record<string, unknown>, ok: string): Promise<boolean> => {
    const res = await fetch('/api/admin-csp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = (await res.json().catch((): null => null)) as { error?: string } | null
    if (!res.ok) {
      setMessage(data?.error ?? 'That did not work.')
      return false
    }
    setMessage(ok)
    await load()
    return true
  }

  const problem = useMemo(() => validateBuilder(config), [config])
  const warnings = useMemo(() => builderWarnings(config), [config])
  const preview = useMemo(() => applyBuilder(defaultPolicy, config), [config, defaultPolicy])

  const setEntry = (name: string, fn: (sources: string[], replace: boolean) => { sources: string[]; replace: boolean }) =>
    setConfig((c) => {
      const cur = c.directives[name] ?? { sources: [], replace: false }
      const next = fn(cur.sources, cur.replace)
      const directives = { ...c.directives }
      if (next.sources.length) directives[name] = next
      else delete directives[name]
      return { ...c, directives }
    })

  const addTo = (name: string, source: string) => {
    const value = source.trim()
    if (value) setConfig((c) => addSource(c, name, value))
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {message && <p role="status">{message}</p>}

      <section style={{ display: 'grid', gap: '0.75rem', maxWidth: '44rem' }}>
        <h2>Mode</h2>
        <label>What the builder does<br />
          <select value={config.mode} onChange={(e) => setConfig({ ...config, mode: e.target.value as CspMode })}>
            <option value="off">Off - the site keeps its normal policy</option>
            <option value="report-only">Report only - test the builder&apos;s policy, block nothing</option>
            <option value="enforce">Enforce - the builder&apos;s policy blocks on public pages</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={config.collectReports} onChange={(e) => setConfig({ ...config, collectReports: e.target.checked })} /> Collect violation reports from visitors&apos; browsers
        </label>
        <p>Start with Report only. Browse the public site, then come back to Violations below and allow what is legitimate with one click. The admin never gets the builder&apos;s policy, so a mistake cannot lock you out. The free-text policy in Security settings, Headers still works and is merged first.</p>
      </section>

      <section style={{ display: 'grid', gap: '0.75rem' }}>
        <h2>Directives</h2>
        <p>Each directive starts from the default policy. Sources you pick are added to it; tick Replace the default to use only your list for that directive.</p>
        {PICKER_DIRECTIVES.map((d) => {
          const entry = config.directives[d.name] ?? { sources: [], replace: false }
          const hosts = KNOWN_HOSTS.filter((h) => h.directives.includes(d.name))
          return (
            <fieldset key={d.name} style={{ display: 'grid', gap: '0.5rem' }}>
              <legend>{d.label}</legend>
              <small>{d.help}</small>
              {entry.sources.length > 0 && (
                <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', listStyle: 'none', padding: 0, margin: 0 }}>
                  {entry.sources.map((s) => (
                    <li key={s}><code>{s}</code>{' '}
                      <button type="button" aria-label={`Remove ${s} from ${d.name}`} onClick={() => setEntry(d.name, (src, replace) => ({ sources: src.filter((x) => x !== s), replace }))}>Remove</button>
                    </li>
                  ))}
                </ul>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <select aria-label={`Add a keyword to ${d.name}`} value="" onChange={(e) => addTo(d.name, e.target.value)}>
                  <option value="">Add a keyword...</option>
                  {KEYWORD_SOURCES.map((k) => <option key={k.value} value={k.value}>{k.label}{k.risky ? ' - risky' : ''}</option>)}
                </select>
                {hosts.length > 0 && (
                  <select aria-label={`Add a known host to ${d.name}`} value="" onChange={(e) => addTo(d.name, e.target.value)}>
                    <option value="">Add a known host...</option>
                    {hosts.map((h) => <option key={h.host} value={h.host}>{h.label}{h.inDefault ? ' (already in the default)' : ''}</option>)}
                  </select>
                )}
                <input
                  aria-label={`Type a host for ${d.name}`}
                  placeholder="https://example.com"
                  value={typed[d.name] ?? ''}
                  onChange={(e) => setTyped({ ...typed, [d.name]: e.target.value })}
                />
                <button type="button" onClick={() => { addTo(d.name, typed[d.name] ?? ''); setTyped({ ...typed, [d.name]: '' }) }}>Add host</button>
              </div>
              {entry.sources.length > 0 && (
                <label><input type="checkbox" checked={entry.replace} onChange={(e) => setEntry(d.name, (src) => ({ sources: src, replace: e.target.checked }))} /> Replace the default for {d.name}</label>
              )}
            </fieldset>
          )
        })}
      </section>

      <section style={{ display: 'grid', gap: '0.75rem', maxWidth: '60rem' }}>
        <h2>Check and save</h2>
        {problem && <p role="alert">{problem}</p>}
        {warnings.map((w) => <p key={w}>Note: {w}</p>)}
        <p>Builder directives: <code>{builderPolicyText(config) || 'none yet'}</code></p>
        <details>
          <summary>Full policy sent on public pages</summary>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{preview}</pre>
          <small>The free-text policy from Security settings is merged in on top of this by the server.</small>
        </details>
        <div><button type="button" disabled={!loaded || !!problem} onClick={() => void post({ action: 'save', config }, 'Saved. Changes reach every server within 30 seconds.')}>Save</button></div>
      </section>

      <section style={{ display: 'grid', gap: '0.75rem' }}>
        <h2>Violations</h2>
        <p>What browsers reported as blocked (or, in Report only, as would-be blocked). Repeats are counted, and the log holds at most 300 different entries. Allow adds the host to the matching directive and saves it.</p>
        {rows.length === 0 ? (
          <p>No reports yet.</p>
        ) : (
          <>
            <table>
              <thead>
                <tr><th scope="col">Directive</th><th scope="col">Blocked</th><th scope="col">Page</th><th scope="col">Mode</th><th scope="col">Count</th><th scope="col">Last seen</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><code>{r.directive}</code></td>
                    <td><code>{r.blocked}</code></td>
                    <td><code>{r.page}</code></td>
                    <td>{r.disposition === 'report' ? 'Report only' : 'Blocked'}</td>
                    <td>{r.hits}</td>
                    <td>{r.lastSeen.slice(0, 16).replace('T', ' ')}</td>
                    <td>
                      {r.suggestion ? (
                        <button type="button" onClick={() => void post({ action: 'allow', id: r.id }, `Allowed ${r.suggestion?.source} in ${r.suggestion?.directive}. It is saved and live within 30 seconds.`)}>
                          Allow {r.suggestion.source}
                        </button>
                      ) : (
                        <small>Inline or eval: needs a keyword or nonce</small>
                      )}{' '}
                      <button type="button" onClick={() => void post({ action: 'dismiss', ids: [r.id] }, 'Dismissed.')}>Dismiss</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div><button type="button" onClick={() => void post({ action: 'dismiss', ids: 'all' }, 'Cleared.')}>Clear all</button></div>
          </>
        )}
      </section>
    </div>
  )
}
