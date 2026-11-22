'use client'

import { useCallback, useEffect, useState } from 'react'

import { useAdminHref } from '@/admin/adminRoute/AdminRouteProvider'

import type { MetaField } from './metaFields'
import type { Quota } from './quota'
import type { Rendition } from './renditions'
import type { Collection, Settings, StorageTotals } from './store'

type Overview = {
  settings: Settings
  collections: Collection[]
  folderRules: Array<{ path: string; visibility: 'public' | 'private' }>
  fields: MetaField[]
  expiring: Array<{ mediaId: number; licenceExpiry: string }>
  expired: Array<{ mediaId: number; licenceExpiry: string }>
  renditions: Rendition[]
  totals: StorageTotals
  quotaUsage: Array<Quota & { usedBytes: number }>
}

const mb = (bytes: number): string => `${(bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0)} MB`

const blankField = { id: 0, label: '', key: '', type: 'text', options: '', required: false, searchable: true, appliesTo: 'all' }

/** Asset manager admin page: settings, collections, custom metadata fields and the licence expiry report. */
export function AssetManagerPanel() {
  const adminHref = useAdminHref()
  const [data, setData] = useState<Overview | null>(null)
  const [message, setMessage] = useState('')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [collection, setCollection] = useState({ id: 0, name: '', description: '' })
  const [field, setField] = useState(blankField)
  const [rule, setRule] = useState({ path: '', visibility: 'private' })
  const [share, setShare] = useState({ collectionId: 0, days: '7', password: '', maxDownloads: '' })
  const [link, setLink] = useState('')
  const [preset, setPreset] = useState({ id: 0, name: '', width: '1200', height: '0', fit: 'scale-down', format: 'auto' })
  const [importUrl, setImportUrl] = useState({ url: '', folder: '' })
  const [pin, setPin] = useState({ account: '', pin: '', folder: '' })
  const [pinAccounts, setPinAccounts] = useState<Array<{ value: string; label: string }>>([])
  const [pickers, setPickers] = useState<{ roles: Array<{ value: string; label: string }>; companies: Array<{ id: string; name: string }> }>({ roles: [], companies: [] })

  const load = useCallback(async (): Promise<void> => {
    const res = await fetch('/api/admin-media-dam')
    const body = (await res.json().catch(() => ({}))) as Partial<Overview> & { error?: string }
    if (!res.ok) return setMessage(body.error ?? 'Could not load the asset manager.')
    setData(body as Overview)
    setSettings((body as Overview).settings)
    const pick = await fetch('/api/admin-media-folders')
    if (pick.ok) {
      const p = (await pick.json()) as { roles?: typeof pickers.roles; companies?: typeof pickers.companies }
      setPickers({ roles: p.roles ?? [], companies: p.companies ?? [] })
    }
  }, [])
  useEffect(() => {
    void fetch('/api/admin-social-accounts', { cache: 'no-store' })
      .then((r): Promise<{ options?: Array<{ value: string; label: string }> }> => (r.ok ? r.json() : Promise.resolve({ options: [] })))
      .then((j) => setPinAccounts((j.options ?? []).filter((o) => o.label.endsWith('(pinterest)'))))
      .catch((): void => undefined)
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (payload: Record<string, unknown>, okText: string): Promise<boolean> => {
    setMessage('')
    const res = await fetch('/api/admin-media-dam', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      setMessage(body.error ?? 'That did not work.')
      return false
    }
    setMessage(okText)
    await load()
    return true
  }

  if (!data || !settings) return <p role="status">{message || 'Loading...'}</p>
  const s = settings
  const up = (patch: Partial<Settings>): void => setSettings({ ...s, ...patch })

  return (
    <div className="stack">
      {message ? <p role="alert" className="badge">{message}</p> : null}

      <h2>Licence expiry</h2>
      {data.expired.length === 0 && data.expiring.length === 0 ? <p className="text-muted">No licences are expired or about to expire.</p> : null}
      {data.expired.length > 0 ? <p><strong>Expired ({data.expired.length}):</strong> {data.expired.map((e) => <a key={e.mediaId} href={adminHref(`/content/media/${e.mediaId}`)} style={{ marginRight: 8 }}>#{e.mediaId} ({e.licenceExpiry})</a>)}</p> : null}
      {data.expiring.length > 0 ? <p><strong>Expiring within {s.expiryWarnDays} days ({data.expiring.length}):</strong> {data.expiring.map((e) => <a key={e.mediaId} href={adminHref(`/content/media/${e.mediaId}`)} style={{ marginRight: 8 }}>#{e.mediaId} ({e.licenceExpiry})</a>)}</p> : null}
      <p className="text-muted">An expired, embargoed, not yet started or archived file is hidden from the media picker and flagged on its own page.</p>

      <h2>Collections</h2>
      {data.collections.length === 0 ? <p className="text-muted">No collections yet. Add files to one from the Media page: select files, pick a collection, Add to collection.</p> : (
        <ul className="stack" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {data.collections.map((c) => (
            <li key={c.id} className="cluster">
              <strong>{c.name}</strong>
              <span className="text-muted">{c.smart ? 'Smart collection (follows a saved search)' : `${c.count} file${c.count === 1 ? '' : 's'}`}{c.description ? `, ${c.description}` : ''}</span>
              <a className="btn" href={adminHref(`/media?collection=${c.id}`)}>Open</a>
              <button type="button" className="btn" onClick={() => setCollection({ id: c.id, name: c.name, description: c.description })}>Edit</button>
              <button type="button" className="btn" onClick={() => { if (window.confirm(`Delete collection ${c.name}? The files stay in the library.`)) void post({ action: 'deleteCollection', id: c.id }, 'Collection deleted.') }}>Delete</button>
            </li>
          ))}
        </ul>
      )}
      <div className="card"><div className="card-body stack">
        <strong>{collection.id ? 'Edit collection' : 'Add a collection'}</strong>
        <div className="cluster">
          <label className="field">Name<input className="input" value={collection.name} onChange={(e) => setCollection({ ...collection, name: e.target.value })} /></label>
          <label className="field">Description<input className="input" value={collection.description} onChange={(e) => setCollection({ ...collection, description: e.target.value })} /></label>
        </div>
        <div className="cluster">
          <button type="button" className="btn" onClick={() => void post({ action: 'saveCollection', ...collection, id: collection.id || undefined }, 'Saved.').then((ok) => { if (ok) setCollection({ id: 0, name: '', description: '' }) })}>{collection.id ? 'Save changes' : 'Add collection'}</button>
          {collection.id ? <button type="button" className="btn" onClick={() => setCollection({ id: 0, name: '', description: '' })}>Cancel</button> : null}
        </div>
      </div></div>

      <h2>Private folders</h2>
      <p className="text-muted">Files in a private folder (and its sub-folders) are not reachable by their public address. Staff who can read media still see them, and a share link can hand one out. A folder setting applies to files added later too. A change can take about ten seconds to apply everywhere.</p>
      {data.folderRules.length === 0 ? <p className="text-muted">No folder rules yet.</p> : (
        <ul className="stack" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {data.folderRules.map((r) => (
            <li key={r.path} className="cluster">
              <strong>{r.path}</strong><span className="text-muted">{r.visibility}</span>
              <button type="button" className="btn" onClick={() => void post({ action: 'saveFolderRule', path: r.path, visibility: 'inherit' }, 'Rule removed.')}>Remove rule</button>
            </li>
          ))}
        </ul>
      )}
      <div className="card"><div className="card-body stack">
        <div className="cluster">
          <label className="field">Folder<input className="input" value={rule.path} onChange={(e) => setRule({ ...rule, path: e.target.value })} placeholder="e.g. contracts" /></label>
          <label className="field">Make it
            <select className="input" value={rule.visibility} onChange={(e) => setRule({ ...rule, visibility: e.target.value })}><option value="private">Private</option><option value="public">Public (inside a private folder)</option></select>
          </label>
          <button type="button" className="btn" onClick={() => void post({ action: 'saveFolderRule', ...rule }, 'Folder rule saved.').then((ok) => { if (ok) setRule({ path: '', visibility: 'private' }) })}>Save folder rule</button>
        </div>
      </div></div>

      <h2>Share a collection</h2>
      <div className="card"><div className="card-body stack">
        <div className="cluster">
          <label className="field">Collection
            <select className="input" value={share.collectionId} onChange={(e) => setShare({ ...share, collectionId: Number(e.target.value) })}>
              <option value={0}>Choose...</option>{data.collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="field">Works for (days)<input className="input" inputMode="numeric" value={share.days} onChange={(e) => setShare({ ...share, days: e.target.value })} /></label>
          <label className="field">Password (optional)<input className="input" autoComplete="off" value={share.password} onChange={(e) => setShare({ ...share, password: e.target.value })} /></label>
          <label className="field">Download limit (optional)<input className="input" inputMode="numeric" value={share.maxDownloads} onChange={(e) => setShare({ ...share, maxDownloads: e.target.value })} /></label>
        </div>
        <div><button type="button" className="btn" onClick={() => {
          void (async () => {
            setMessage('')
            const res = await fetch('/api/admin-media-dam', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'createShare', kind: 'collection', targetId: share.collectionId, days: Number(share.days), password: share.password, maxDownloads: share.maxDownloads }) })
            const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
            if (!res.ok || !body.url) return setMessage(body.error ?? 'The link could not be made.')
            setLink(body.url)
            setShare({ ...share, password: '' })
          })()
        }}>Create share link</button></div>
        {link ? <label className="field">Copy this link now, it is not shown again<input className="input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} /></label> : null}
        <p className="text-muted">The link opens a page that lists the collection&apos;s files with a download button for each and a zip of all of them. Files that are expired, embargoed or archived are left out.</p>
      </div></div>

      <h2>Metadata fields</h2>
      <p className="text-muted">Extra details you want on every file, filled in on the file&apos;s page. Searchable fields are found by the media search.</p>
      {data.fields.length === 0 ? <p className="text-muted">No fields yet.</p> : (
        <ul className="stack" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {data.fields.map((f) => (
            <li key={f.id} className="cluster">
              <strong>{f.label}</strong>
              <span className="text-muted">{f.key}, {f.type}{f.required ? ', required' : ''}{f.searchable ? ', searchable' : ''}, {f.appliesTo === 'all' ? 'all files' : `${f.appliesTo} files`}</span>
              <button type="button" className="btn" onClick={() => setField({ id: f.id, label: f.label, key: f.key, type: f.type, options: f.options.join('\n'), required: f.required, searchable: f.searchable, appliesTo: f.appliesTo })}>Edit</button>
              <button type="button" className="btn" onClick={() => { if (window.confirm(`Delete the field ${f.label}? Values already entered stay stored but stop showing.`)) void post({ action: 'deleteField', id: f.id }, 'Field deleted.') }}>Delete</button>
            </li>
          ))}
        </ul>
      )}
      <div className="card"><div className="card-body stack">
        <strong>{field.id ? 'Edit field' : 'Add a field'}</strong>
        <div className="cluster">
          <label className="field">Label<input className="input" value={field.label} onChange={(e) => setField({ ...field, label: e.target.value })} /></label>
          <label className="field">Key (optional)<input className="input" value={field.key} onChange={(e) => setField({ ...field, key: e.target.value })} /></label>
          <label className="field">Type
            <select className="input" value={field.type} onChange={(e) => setField({ ...field, type: e.target.value })}>
              <option value="text">Text</option><option value="select">Select</option><option value="date">Date</option><option value="number">Number</option><option value="link">Link</option>
            </select>
          </label>
          <label className="field">Applies to
            <select className="input" value={field.appliesTo} onChange={(e) => setField({ ...field, appliesTo: e.target.value })}>
              <option value="all">All files</option><option value="image">Images</option><option value="video">Videos</option><option value="audio">Audio</option><option value="document">Documents</option>
            </select>
          </label>
        </div>
        {field.type === 'select' ? <label className="field">Options (one per line)<textarea className="input" rows={4} value={field.options} onChange={(e) => setField({ ...field, options: e.target.value })} /></label> : null}
        <div className="cluster">
          <label><input type="checkbox" checked={field.required} onChange={(e) => setField({ ...field, required: e.target.checked })} /> Required</label>
          <label><input type="checkbox" checked={field.searchable} onChange={(e) => setField({ ...field, searchable: e.target.checked })} /> Searchable</label>
        </div>
        <div className="cluster">
          <button type="button" className="btn" onClick={() => void post({ action: 'saveField', ...field, id: field.id || undefined }, 'Saved.').then((ok) => { if (ok) setField(blankField) })}>{field.id ? 'Save changes' : 'Add field'}</button>
          {field.id ? <button type="button" className="btn" onClick={() => setField(blankField)}>Cancel</button> : null}
        </div>
      </div></div>

      <h2>Storage</h2>
      <p>{data.totals.files} files, {mb(data.totals.bytes)}{s.quotaMb > 0 ? ` of ${s.quotaMb} MB` : ''}.</p>
      <ul className="stack" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {data.totals.byKind.map((k) => <li key={k.kind}>{k.kind}: {k.files} files, {mb(k.bytes)}</li>)}
      </ul>
      {data.totals.topFolders.length > 0 ? <p className="text-muted">Largest folders: {data.totals.topFolders.map((f) => `${f.folder || 'top level'} (${mb(f.bytes)})`).join(', ')}</p> : null}
      {data.quotaUsage.length > 0 ? <ul className="stack" style={{ margin: 0, padding: 0, listStyle: 'none' }}>{data.quotaUsage.map((q) => <li key={`${q.scope}:${q.key}`}>{q.scope} {pickers.companies.find((c) => c.id === q.key)?.name ?? q.key}: {mb(q.usedBytes)} of {q.mb} MB</li>)}</ul> : null}

      <h2>Rendition presets</h2>
      <p className="text-muted">Named sizes a picture can be downloaded in from its page. Needs the Cloudflare Images service.</p>
      <ul className="stack" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {data.renditions.map((r) => (
          <li key={r.id} className="cluster">
            <strong>{r.name}</strong> <span className="text-muted">{r.width || 'auto'} x {r.height || 'auto'}, {r.fit}, {r.format}</span>
            <button type="button" className="btn" onClick={() => setPreset({ id: r.id, name: r.name, width: String(r.width), height: String(r.height), fit: r.fit, format: r.format })}>Edit</button>
            <button type="button" className="btn" onClick={() => { if (window.confirm(`Delete preset ${r.name}?`)) void post({ action: 'deleteRendition', id: r.id }, 'Preset deleted.') }}>Delete</button>
          </li>
        ))}
      </ul>
      <div className="card"><div className="card-body stack">
        <label className="field">Name<input className="input" value={preset.name} maxLength={60} onChange={(e) => setPreset({ ...preset, name: e.target.value })} /></label>
        <label className="field">Width (0 for auto)<input className="input" type="number" min={0} max={8000} value={preset.width} onChange={(e) => setPreset({ ...preset, width: e.target.value })} /></label>
        <label className="field">Height (0 for auto)<input className="input" type="number" min={0} max={8000} value={preset.height} onChange={(e) => setPreset({ ...preset, height: e.target.value })} /></label>
        <label className="field">Fit<select className="input" value={preset.fit} onChange={(e) => setPreset({ ...preset, fit: e.target.value })}>{['scale-down', 'contain', 'cover', 'crop', 'pad'].map((f) => <option key={f} value={f}>{f}</option>)}</select></label>
        <label className="field">Format<select className="input" value={preset.format} onChange={(e) => setPreset({ ...preset, format: e.target.value })}>{['auto', 'jpeg', 'png', 'webp', 'avif'].map((f) => <option key={f} value={f}>{f}</option>)}</select></label>
        <div><button type="button" className="btn" onClick={() => void post({ action: 'saveRendition', ...preset }, 'Preset saved.').then((ok) => { if (ok) setPreset({ id: 0, name: '', width: '1200', height: '0', fit: 'scale-down', format: 'auto' }) })}>{preset.id ? 'Save preset' : 'Add preset'}</button></div>
      </div></div>

      <h2>Import a file</h2>
      <p className="text-muted">From a web address (https) or a Google Drive link to one file shared as &quot;Anyone with the link&quot;.</p>
      <div className="card"><div className="card-body stack">
        <label className="field">Address<input className="input" type="url" value={importUrl.url} onChange={(e) => setImportUrl({ ...importUrl, url: e.target.value })} /></label>
        <label className="field">Folder (optional)<input className="input" value={importUrl.folder} onChange={(e) => setImportUrl({ ...importUrl, folder: e.target.value })} /></label>
        <div><button type="button" className="btn" onClick={() => {
          void (async () => {
            setMessage('')
            const res = await fetch('/api/admin-media-import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(importUrl) })
            const body = (await res.json().catch(() => ({}))) as { error?: string; doc?: { id: number; filename: string }; duplicateOf?: number | null }
            if (!res.ok) return setMessage(body.error ?? 'The import did not work.')
            setMessage(`Imported ${body.doc?.filename ?? 'the file'}${body.duplicateOf ? ` (same bytes as file #${body.duplicateOf})` : ''}.`)
            setImportUrl({ url: '', folder: importUrl.folder })
            await load()
          })()
        }}>Import</button></div>
      </div></div>

      {pinAccounts.length > 0 ? (
        <>
          <h2>Import from Pinterest</h2>
          <p className="text-muted">Paste a pin address to import that one picture, or leave it empty to import the latest pictures (up to 12) from the board of the connected account. Each is saved like an upload.</p>
          <div className="card"><div className="card-body stack">
            <label className="field">Pinterest account<select className="input" value={pin.account || pinAccounts[0]?.value} onChange={(e) => setPin({ ...pin, account: e.target.value })}>{pinAccounts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
            <label className="field">Pin address (optional)<input className="input" type="url" value={pin.pin} placeholder="https://www.pinterest.com/pin/123456789/" onChange={(e) => setPin({ ...pin, pin: e.target.value })} /></label>
            <label className="field">Folder (optional)<input className="input" value={pin.folder} onChange={(e) => setPin({ ...pin, folder: e.target.value })} /></label>
            <div><button type="button" className="btn" onClick={() => {
              void (async () => {
                setMessage('')
                const res = await fetch('/api/admin-media-pinterest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...pin, account: pin.account || pinAccounts[0]?.value }) })
                const body = (await res.json().catch(() => ({}))) as { error?: string; imported?: number; skipped?: number }
                if (!res.ok) return setMessage(body.error ?? 'The Pinterest import did not work.')
                setMessage(`Imported ${body.imported ?? 0} picture(s) from Pinterest${body.skipped ? `, ${body.skipped} skipped` : ''}.`)
                await load()
              })()
            }}>Import from Pinterest</button></div>
          </div></div>
        </>
      ) : null}

      <h2>Settings</h2>
      <div className="card"><div className="card-body stack">
        <label><input type="checkbox" checked={s.autoExtract} onChange={(e) => up({ autoExtract: e.target.checked })} /> Read camera data from JPEG photos on upload</label>
        <label><input type="checkbox" checked={s.stripGps} onChange={(e) => up({ stripGps: e.target.checked })} /> Do not keep GPS location from photos</label>
        <label><input type="checkbox" checked={s.requireApproval} onChange={(e) => up({ requireApproval: e.target.checked })} /> New uploads wait for approval (files not approved cannot be picked)</label>
        <label><input type="checkbox" checked={s.blockUsedDelete} onChange={(e) => up({ blockUsedDelete: e.target.checked })} /> Warn before deleting a file that is in use</label>
        <label className="field">When the exact same file is uploaded again
          <select className="input" value={s.duplicateAction} onChange={(e) => up({ duplicateAction: e.target.value as Settings['duplicateAction'] })}>
            <option value="warn">Warn and keep both</option><option value="block">Refuse the upload</option><option value="allow">Do nothing</option>
          </select>
        </label>
        <label className="field">Warn about licences expiring within (days)<input className="input" type="number" min={0} max={365} value={s.expiryWarnDays} onChange={(e) => up({ expiryWarnDays: Number(e.target.value) })} /></label>
        <label className="field">Previous versions kept per file<input className="input" type="number" min={0} max={50} value={s.keepVersions} onChange={(e) => up({ keepVersions: Number(e.target.value) })} /></label>
        <label className="field">Storage limit (MB, 0 for none)<input className="input" type="number" min={0} value={s.quotaMb} onChange={(e) => up({ quotaMb: Number(e.target.value) })} /></label>
        <fieldset className="stack">
          <legend>Storage limits per role or company (MB)</legend>
          {s.quotas.map((q, i) => (
            <div key={i} className="cluster">
              <select className="input" value={`${q.scope}:${q.key}`} onChange={(e) => { const [scope, ...rest] = e.target.value.split(':'); up({ quotas: s.quotas.map((x, j) => (j === i ? { ...x, scope: scope as Quota['scope'], key: rest.join(':') } : x)) }) }}>
                <option value={`${q.scope}:${q.key}`}>{q.key || 'Choose'}</option>
                {pickers.roles.map((r) => <option key={`role:${r.value}`} value={`role:${r.value}`}>Role: {r.label}</option>)}
                {pickers.companies.map((c) => <option key={`company:${c.id}`} value={`company:${c.id}`}>Company: {c.name}</option>)}
              </select>
              <input className="input" type="number" min={1} value={q.mb} onChange={(e) => up({ quotas: s.quotas.map((x, j) => (j === i ? { ...x, mb: Number(e.target.value) } : x)) })} />
              <button type="button" className="btn" onClick={() => up({ quotas: s.quotas.filter((_, j) => j !== i) })}>Remove</button>
            </div>
          ))}
          <div><button type="button" className="btn" onClick={() => up({ quotas: [...s.quotas, { scope: 'role', key: pickers.roles[0]?.value ?? 'editor', mb: 1000 }] })}>Add a limit</button></div>
          <p className="text-muted">Counts what the people in that role or company uploaded. Over the limit, uploads are refused.</p>
        </fieldset>
        <div><button type="button" className="btn" onClick={() => void post({ action: 'saveSettings', ...s }, 'Settings saved.')}>Save settings</button></div>
      </div></div>
    </div>
  )
}
