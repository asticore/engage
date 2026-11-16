'use client'

import React, { useCallback, useEffect, useState } from 'react'

import { describeBytes, type ResetEvery } from '../core'

type Loaded = {
  settings: { resetEvery: ResetEvery; lastResetAt: string | null; lastResult: string; banner: string }
  snapshot: { takenAt: string; size: number } | null
  choices: { value: ResetEvery; label: string }[]
}

/** Admin screen for agency demos: saved copy, reset, demo accounts and the package download. English only. */
export const DemosPanel: React.FC = () => {
  const [data, setData] = useState<Loaded | null>(null)
  const [every, setEvery] = useState<ResetEvery>('off')
  const [banner, setBanner] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin-demos')
    const out = (await res.json().catch((): null => null)) as (Loaded & { error?: string }) | null
    if (!res.ok || !out) return setMessage(out?.error ?? 'Could not load the demo settings.')
    setData(out)
    setEvery(out.settings.resetEvery)
    setBanner(out.settings.banner)
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (body: Record<string, unknown>, ok: string): Promise<Record<string, unknown> | null> => {
    setBusy(true)
    const res = await fetch('/api/admin-demos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const out = (await res.json().catch((): null => null)) as Record<string, unknown> | null
    setBusy(false)
    if (!res.ok) {
      setMessage(String(out?.error ?? 'That did not work.'))
      return null
    }
    setMessage(String(out?.message ?? ok))
    await load()
    return out
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {message && <p role="status">{message}</p>}

      <section aria-labelledby="demo-copy">
        <h2 id="demo-copy">Saved demo copy</h2>
        <p>
          {data?.snapshot ? `Saved ${new Date(data.snapshot.takenAt).toLocaleString()} (${describeBytes(data.snapshot.size)}).` : 'No copy saved yet.'} The copy holds settings, header and footer, redirects, page templates, field groups, pages, posts, products and picture details. It never holds users, roles, customers or keys.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" disabled={busy} onClick={() => void post({ action: 'snapshot' }, 'Demo copy saved.')}>Save the site as the demo copy</button>
          <button type="button" disabled={busy || !data?.snapshot} onClick={() => void post({ action: 'reset' }, 'Demo reset.')}>Reset to the saved copy now</button>
          <a href="/api/admin-demos?download=package" download>Download as an importable package</a>
        </div>
        <p>A reset writes everything in the copy back. Items added after the copy was saved stay. Import a package on a client site from Settings, Export and import.</p>
        {data?.settings.lastResetAt && <p>Last reset {new Date(data.settings.lastResetAt).toLocaleString()}: {data.settings.lastResult}</p>}
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void post({ action: 'settings', resetEvery: every, banner }, 'Saved.')
        }}
        style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}
      >
        <label>Reset on a schedule<br />
          <select value={every} onChange={(e) => setEvery(e.target.value as ResetEvery)}>
            {(data?.choices ?? []).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <label>Note for the team<br /><input type="text" maxLength={200} value={banner} onChange={(e) => setBanner(e.target.value)} /></label>
        <button type="submit" disabled={busy}>Save</button>
      </form>

      <section aria-labelledby="demo-accounts">
        <h2 id="demo-accounts">Demo account</h2>
        <p>Makes a view-only account (the Viewer role, limited to this domain) so a client can look around the admin without changing anything. The password is shown once.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void post({ action: 'account', email }, '').then((out) => {
              if (out?.password) {
                setMessage(`Account created for ${email}. One-time password: ${String(out.password)} (copy it now, it is not shown again).`)
                setEmail('')
              }
            })
          }}
          style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}
        >
          <label>Email<br /><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <button type="submit" disabled={busy}>Create view-only account</button>
        </form>
      </section>
    </div>
  )
}
