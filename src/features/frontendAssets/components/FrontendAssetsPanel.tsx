'use client'

import React, { useCallback, useEffect, useState } from 'react'

import type { AssetPreset } from '../builtin'
import { EMPTY_FONT_AWESOME, type FontAwesomeConfig } from '../fontAwesome'
import { EMPTY_FRONTEND_ASSETS, type FrontendAsset, type FrontendAssetsConfig } from '../config'

type Loaded = { config?: FrontendAssetsConfig; presets?: AssetPreset[]; builtin?: { shine: { version: string; url: string }; spark: { version: string; url: string } }; error?: string }

const newId = () => `a${Math.random().toString(36).slice(2, 9)}`
const blank = (): FrontendAsset => ({ id: newId(), label: '', kind: 'css', url: 'https://', integrity: '', position: 'head', defer: true, async: false, scope: 'everywhere', enabled: true })

/** Admin screen: extra CSS and JavaScript files for the public site and the customer portal. English only. */
export const FrontendAssetsPanel: React.FC = () => {
  const [config, setConfig] = useState<FrontendAssetsConfig>(EMPTY_FRONTEND_ASSETS)
  const [presets, setPresets] = useState<AssetPreset[]>([])
  const [builtin, setBuiltin] = useState<Loaded['builtin']>()
  const [message, setMessage] = useState('')
  const [dirty, setDirty] = useState(false)
  const [faMessage, setFaMessage] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin-frontend-assets')
    const data = (await res.json().catch((): null => null)) as Loaded | null
    if (!res.ok) return setMessage(data?.error ?? 'Could not load the list.')
    setConfig(data?.config ?? EMPTY_FRONTEND_ASSETS)
    setPresets(data?.presets ?? [])
    setBuiltin(data?.builtin)
    setDirty(false)
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const edit = (next: FrontendAsset[]) => {
    setConfig({ ...config, assets: next })
    setDirty(true)
  }
  const change = (id: string, patch: Partial<FrontendAsset>) => edit(config.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)))

  const addPreset = (id: string) => {
    const preset = presets.find((p) => p.id === id)
    if (!preset) return
    edit([...config.assets, ...preset.assets.map((a) => ({ ...blank(), label: `${preset.label} (${a.kind === 'css' ? 'CSS' : 'JS'})`, kind: a.kind, url: a.url, integrity: a.integrity ?? '', defer: a.defer ?? true }))])
  }

  const fa: FontAwesomeConfig = config.fontAwesome ?? EMPTY_FONT_AWESOME
  const setFa = (patch: Partial<FontAwesomeConfig>) => {
    setConfig({ ...config, fontAwesome: { ...fa, ...patch } })
    setDirty(true)
    setFaMessage('')
  }
  const testFa = async () => {
    setFaMessage('Checking...')
    const res = await fetch('/api/admin-frontend-assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test-font-awesome', fontAwesome: fa }) })
    const data = (await res.json().catch((): null => null)) as { message?: string } | null
    setFaMessage(data?.message ?? 'The check did not run.')
  }

  const save = async () => {
    const res = await fetch('/api/admin-frontend-assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) })
    const data = (await res.json().catch((): null => null)) as { error?: string; config?: FrontendAssetsConfig } | null
    if (!res.ok) return setMessage(data?.error ?? 'That did not work.')
    setConfig(data?.config ?? config)
    setDirty(false)
    setMessage('Saved. Public pages pick it up within about 30 seconds.')
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {message && <p role="status">{message}</p>}

      <section style={{ display: 'grid', gap: '0.5rem', maxWidth: '48rem' }}>
        <h2>Shine and Spark</h2>
        <p>
          The public site and the customer portal load Shine (styling) and Spark (effects) from their GitHub releases through jsDelivr, so your site does not host them. Each file is checked by an integrity hash and falls back to a bundled copy if the CDN cannot be reached.
          {builtin && (
            <>
              {' '}Now: Shine {builtin.shine.version} and Spark {builtin.spark.version}.
            </>
          )}
        </p>
      </section>

      <section style={{ display: 'grid', gap: '0.5rem', maxWidth: '48rem' }}>
        <h2>Font Awesome Pro</h2>
        <p>
          Own a Font Awesome Pro licence? Add it here and the Pro icon styles (regular, light, thin, duotone, sharp) appear in the icon picker for this site only. Nothing from Pro is bundled with Engage. Without a licence, or if it stops working, icons use the free set.
        </p>
        <label>How you load it<br />
          <select value={fa.mode} onChange={(e) => setFa({ mode: e.target.value === 'kit' ? 'kit' : e.target.value === 'cdn' ? 'cdn' : 'off' })}>
            <option value="off">Off (free icons only)</option>
            <option value="kit">Kit code</option>
            <option value="cdn">Pro stylesheet address</option>
          </select>
        </label>
        {fa.mode === 'kit' && (
          <label>Kit code (10 letters and numbers, or paste the kit address)<br />
            <input type="text" value={fa.kitCode} onChange={(e) => setFa({ kitCode: e.target.value })} placeholder="1a2b3c4d5e" autoComplete="off" />
          </label>
        )}
        {fa.mode === 'cdn' && (
          <label>Pro stylesheet address<br />
            <input type="url" value={fa.cdnUrl} onChange={(e) => setFa({ cdnUrl: e.target.value })} placeholder="https://kit-pro.fontawesome.com/releases/v6/css/pro.min.css" autoComplete="off" />
          </label>
        )}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" disabled={fa.mode === 'off'} onClick={() => void testFa()}>Test</button>
          <button type="button" disabled={!dirty} onClick={() => void save()}>Save</button>
          {faMessage && <span role="status">{faMessage}</span>}
        </div>
        <p>A kit also needs this site&apos;s domain allowed in the Font Awesome kit settings. Removing the licence switches every Pro icon back to its solid free version.</p>
      </section>

      <section style={{ display: 'grid', gap: '0.75rem' }}>
        <h2>Your own files</h2>
        <p style={{ maxWidth: '48rem' }}>
          Add any stylesheet or script by its https address: Bootstrap, Tailwind, Font Awesome, a widget. They load on the public site and the customer portal only, never in the admin. Add an integrity value (sha384-...) when the provider publishes one, so a changed file is refused. Only add files you trust: a script can do anything on your pages.
        </p>

        {config.assets.length === 0 && <p>No files added yet.</p>}
        {config.assets.map((a) => (
          <fieldset key={a.id} style={{ display: 'grid', gap: '0.5rem', padding: '0.75rem', maxWidth: '48rem' }}>
            <legend>{a.label || 'New file'}</legend>
            <label>Name<br />
              <input type="text" value={a.label} maxLength={80} onChange={(e) => change(a.id, { label: e.target.value })} />
            </label>
            <label>Address (https)<br />
              <input type="url" value={a.url} style={{ width: '100%' }} onChange={(e) => change(a.id, { url: e.target.value })} />
            </label>
            <label>Integrity (optional)<br />
              <input type="text" value={a.integrity} style={{ width: '100%' }} placeholder="sha384-..." onChange={(e) => change(a.id, { integrity: e.target.value })} />
            </label>
            <label>Type<br />
              <select value={a.kind} onChange={(e) => change(a.id, { kind: e.target.value === 'js' ? 'js' : 'css' })}>
                <option value="css">Stylesheet (CSS)</option>
                <option value="js">Script (JavaScript)</option>
              </select>
            </label>
            {a.kind === 'js' && (
              <>
                <label>Placed<br />
                  <select value={a.position} onChange={(e) => change(a.id, { position: e.target.value === 'body' ? 'body' : 'head' })}>
                    <option value="head">In the head</option>
                    <option value="body">End of the body</option>
                  </select>
                </label>
                <label><input type="checkbox" checked={a.defer} onChange={(e) => change(a.id, { defer: e.target.checked })} /> Run after the page is read (defer)</label>
                <label><input type="checkbox" checked={a.async} onChange={(e) => change(a.id, { async: e.target.checked })} /> Load without waiting (async)</label>
              </>
            )}
            <label>Pages<br />
              <select value={a.scope} onChange={(e) => change(a.id, { scope: e.target.value === 'site' || e.target.value === 'portal' ? e.target.value : 'everywhere' })}>
                <option value="everywhere">Public site and customer portal</option>
                <option value="site">Public site only</option>
                <option value="portal">Customer portal only</option>
              </select>
            </label>
            <label><input type="checkbox" checked={a.enabled} onChange={(e) => change(a.id, { enabled: e.target.checked })} /> On</label>
            <div>
              <button type="button" onClick={() => edit(config.assets.filter((x) => x.id !== a.id))}>Remove</button>
            </div>
          </fieldset>
        ))}

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}>
          <label>Add a ready-made one<br />
            <select value="" onChange={(e) => e.target.value && addPreset(e.target.value)}>
              <option value="">Choose...</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => edit([...config.assets, blank()])}>Add your own address</button>
          <button type="button" disabled={!dirty} onClick={() => void save()}>Save</button>
        </div>
        <p style={{ maxWidth: '48rem' }}>Added hosts are allowed in the site&apos;s Content-Security-Policy automatically (the default policy). A policy typed by hand in Security settings is left exactly as written; add the hosts there yourself.</p>
      </section>
    </div>
  )
}
