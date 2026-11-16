'use client'

import { useCallback, useEffect, useState } from 'react'

import { STATUS_LABELS, STATUSES, type AssetStatus, type RightsCheck } from './rights'

type Field = { id: number; label: string; key: string; type: 'text' | 'select' | 'date' | 'number' | 'link'; options: string[]; required: boolean }
type Detail = {
  asset: { rights: Record<string, string | null>; exif: Record<string, unknown>; meta: Record<string, string>; contentHash: string }
  check: RightsCheck
  fields: Field[]
  collections: number[]
  allCollections: Array<{ id: number; name: string }>
  activity: Array<{ action: string; detail: string; createdAt: string }>
  mediaUrl: string | null
  versions: Array<{ id: number; filesize: number; mimeType: string; note: string; createdAt: string; width: number | null; height: number | null }>
}

const input = 'rounded-[4px] border border-[var(--theme-elevation-200)] bg-transparent px-[8px] py-[5px] text-[13px]'
const btn = 'rounded-[4px] border border-[var(--theme-elevation-200)] px-[10px] py-[6px] text-[12px] hover:border-[var(--ac-gold)] hover:text-[var(--ac-gold)] disabled:opacity-50'

/**
 * Asset manager details on a media file: status and licence (with expiry and embargo), custom metadata, camera data and
 * collections. Shows nothing when the Asset manager feature is off. Saves straight to the file, not through the form.
 */
export function DamAssetPanel({ id }: { id: number }) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const [off, setOff] = useState(false)
  const [rights, setRights] = useState<Record<string, string>>({})
  const [meta, setMeta] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [compare, setCompare] = useState(0)
  const [withId, setWithId] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin-media-dam?id=${id}`)
    if (!res.ok) return setOff(true)
    const body = (await res.json()) as Detail
    setDetail(body)
    const r: Record<string, string> = {}
    for (const [k, v] of Object.entries(body.asset.rights)) r[k] = v ?? ''
    setRights(r)
    setMeta(body.asset.meta)
  }, [id])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (payload: Record<string, unknown>, ok: string): Promise<boolean> => {
    setMessage('')
    const res = await fetch('/api/admin-media-dam', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...payload }) })
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    setMessage(res.ok ? ok : (body.error ?? 'That did not work.'))
    if (res.ok) await load()
    return res.ok
  }

  if (off || !detail) return null
  const r = (k: string): string => rights[k] ?? ''
  const set = (k: string, v: string): void => setRights({ ...rights, [k]: v })
  const exif = detail.asset.exif as Record<string, unknown> & { gps?: { lat: number; lon: number } }
  const flagged = detail.check.state !== 'ok'

  return (
    <section aria-label="Asset manager" className="mb-[16px] flex flex-col gap-[12px] rounded-[6px] border border-[var(--theme-elevation-150)] p-[14px]">
      <strong>Asset manager</strong>
      {message ? <p role="alert" className="m-0 text-[12px]">{message}</p> : null}
      {flagged ? <p role="status" className="m-0 text-[13px]">{detail.check.reason}{detail.check.usable ? '' : ' It cannot be picked for new content.'}</p> : null}

      <div className="flex flex-wrap gap-[10px]">
        <label className="flex flex-col text-[12px]">Status
          <select className={input} value={r('status') || 'approved'} onChange={(e) => set('status', e.target.value)}>
            {STATUSES.map((s: AssetStatus) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-[12px]">Licence<input className={input} value={r('licenceType')} onChange={(e) => set('licenceType', e.target.value)} placeholder="e.g. Royalty free" /></label>
        <label className="flex flex-col text-[12px]">Credit<input className={input} value={r('credit')} onChange={(e) => set('credit', e.target.value)} /></label>
        <label className="flex flex-col text-[12px]">Territory<input className={input} value={r('territory')} onChange={(e) => set('territory', e.target.value)} placeholder="e.g. UK only" /></label>
        <label className="flex flex-col text-[12px]">Licence starts<input type="date" className={input} value={r('licenceStart')} onChange={(e) => set('licenceStart', e.target.value)} /></label>
        <label className="flex flex-col text-[12px]">Licence expires<input type="date" className={input} value={r('licenceExpiry')} onChange={(e) => set('licenceExpiry', e.target.value)} /></label>
        <label className="flex flex-col text-[12px]">Embargo until<input type="date" className={input} value={r('embargoUntil')} onChange={(e) => set('embargoUntil', e.target.value)} /></label>
      </div>
      <label className="flex flex-col text-[12px]">Licence terms<textarea className={input} rows={2} value={r('licenceTerms')} onChange={(e) => set('licenceTerms', e.target.value)} /></label>
      <label className="flex flex-col text-[12px]">Usage rights notes<textarea className={input} rows={2} value={r('usageNotes')} onChange={(e) => set('usageNotes', e.target.value)} /></label>
      <label className="flex flex-col text-[12px]">Model or property release (note or reference)<input className={input} value={r('releaseNote')} onChange={(e) => set('releaseNote', e.target.value)} /></label>
      <div><button type="button" className={btn} onClick={() => void post({ action: 'saveRights', ...rights }, 'Rights saved.')}>Save rights</button></div>

      {detail.fields.length > 0 ? (
        <>
          <strong className="text-[13px]">Details</strong>
          <div className="flex flex-wrap gap-[10px]">
            {detail.fields.map((f) => (
              <label key={f.key} className="flex flex-col text-[12px]">{f.label}{f.required ? ' *' : ''}
                {f.type === 'select' ? (
                  <select className={input} value={meta[f.key] ?? ''} onChange={(e) => setMeta({ ...meta, [f.key]: e.target.value })}>
                    <option value="">-</option>
                    {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input className={input} type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : f.type === 'link' ? 'url' : 'text'} value={meta[f.key] ?? ''} onChange={(e) => setMeta({ ...meta, [f.key]: e.target.value })} />
                )}
              </label>
            ))}
          </div>
          <div><button type="button" className={btn} onClick={() => void post({ action: 'saveMeta', values: meta }, 'Details saved.')}>Save details</button></div>
        </>
      ) : null}

      <strong className="text-[13px]">Collections</strong>
      <div className="flex flex-wrap gap-[10px]">
        {detail.allCollections.length === 0 ? <span className="text-[12px]">No collections yet. Create one under Settings, Asset manager.</span> : null}
        {detail.allCollections.map((c) => {
          const inside = detail.collections.includes(c.id)
          return (
            <label key={c.id} className="flex items-center gap-[4px] text-[12px]">
              <input type="checkbox" checked={inside} onChange={() => void post({ action: 'assignCollection', mediaIds: [id], collectionId: c.id, remove: inside }, inside ? 'Removed from the collection.' : 'Added to the collection.')} />
              {c.name}
            </label>
          )
        })}
      </div>

      <strong className="text-[13px]">Camera data</strong>
      {Object.keys(exif).length === 0 ? (
        <p className="m-0 text-[12px]">None stored. <button type="button" className={btn} onClick={() => void post({ action: 'extract', ids: [id] }, 'Camera data read.')}>Read it from the file</button></p>
      ) : (
        <ul className="m-0 list-none p-0 text-[12px]">
          {(['camera', 'lens', 'takenAt', 'exposure', 'creator', 'copyright', 'description'] as const).filter((k) => exif[k]).map((k) => <li key={k}>{k}: {String(exif[k])}</li>)}
          {exif.gps ? <li>GPS: {exif.gps.lat}, {exif.gps.lon}</li> : null}
        </ul>
      )}
      <strong className="text-[13px]">Versions</strong>
      {detail.versions.length === 0 ? <p className="m-0 text-[12px]">No earlier versions. Replacing the file keeps the old one here.</p> : (
        <ul className="m-0 list-none p-0 text-[12px]">
          {detail.versions.map((v) => (
            <li key={v.id} className="mb-[6px] flex flex-wrap items-center gap-[8px]">
              <span>{v.createdAt.slice(0, 16).replace('T', ' ')}, {Math.round(v.filesize / 1024)} KB{v.width && v.height ? `, ${v.width} x ${v.height}` : ''}{v.note ? `, ${v.note}` : ''}</span>
              <button type="button" className={btn} onClick={() => setCompare(compare === v.id ? 0 : v.id)}>{compare === v.id ? 'Hide' : 'Compare'}</button>
              <button type="button" className={btn} onClick={() => { if (window.confirm('Put this version back as the current file? The current file is kept as a version.')) void post({ action: 'restoreVersion', versionId: v.id }, 'Version restored. Reload to see it.') }}>Restore</button>
              <button type="button" className={btn} onClick={() => { if (window.confirm('Delete this stored version?')) void post({ action: 'deleteVersion', versionId: v.id }, 'Version deleted.') }}>Delete</button>
              {compare === v.id && v.mimeType.startsWith('image/') ? (
                <span className="flex w-full gap-[12px]">
                  <span>Version<br /><img alt="Earlier version" style={{ maxWidth: 240, maxHeight: 240 }} src={`/api/admin-media-dam?id=${id}&versionFile=${v.id}`} /></span>
                  <span>Current<br /><img alt="Current file" style={{ maxWidth: 240, maxHeight: 240 }} src={detail.mediaUrl ?? ''} /></span>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <strong className="text-[13px]">Delete or replace</strong>
      <div className="flex flex-wrap items-center gap-[8px] text-[12px]">
        <label className="flex items-center gap-[4px]">Use file number<input className={input} style={{ width: 90 }} inputMode="numeric" value={withId} onChange={(e) => setWithId(e.target.value)} /> instead, everywhere this file is used</label>
        <button type="button" className={btn} onClick={() => { if (window.confirm(`Point every page, post and setting that uses this file at file ${withId}?`)) void post({ action: 'replaceEverywhere', withId: Number(withId) }, 'Every place now uses the other file.') }}>Replace everywhere</button>
        <button type="button" className={btn} onClick={() => { if (window.confirm('Delete this file? If it is in use, the places that use it will lose it.')) void post({ action: 'deleteMedia', force: true }, 'File deleted.').then((ok) => { if (ok) window.location.assign('/admin/media') }) }}>Delete anyway</button>
      </div>

      {detail.activity.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-[12px]">Activity</summary>
          <ul className="m-0 list-none p-0 text-[12px]">{detail.activity.map((a, i) => <li key={i}>{a.createdAt.slice(0, 16).replace('T', ' ')} {a.action}{a.detail ? `: ${a.detail}` : ''}</li>)}</ul>
        </details>
      ) : null}
    </section>
  )
}
