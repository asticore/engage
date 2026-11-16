'use client'

import { useEffect, useState } from 'react'

import { postJson } from '@/features/media/admin/mediaApi'
import type { FolderRecord } from '@/features/media/folderRecords'

type Props = {
  record: FolderRecord
  roles: Array<{ value: string; label: string }>
  companies: Array<{ id: string; name: string }>
  isAdmin: boolean
  onSaved: () => void
}

/** Settings for one folder: colour, description, who may use it, and defaults for new files. */
export function MediaFolderSettings({ record, roles, companies, isAdmin, onSaved }: Props) {
  const [draft, setDraft] = useState(record)
  const [message, setMessage] = useState('')
  useEffect(() => {
    setDraft(record)
    setMessage('')
  }, [record])
  const toggle = (list: string[], value: string): string[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  const save = async (): Promise<void> => {
    const res = await postJson<{ ok: boolean }>('/api/admin-media-folders', { action: 'update', path: record.path, ...draft })
    if (res.ok === false) return setMessage(res.error)
    setMessage('Folder saved.')
    onSaved()
  }
  const input = 'rounded-[3px] border border-[var(--theme-elevation-200)] px-[6px] py-[3px] text-[calc(var(--base)*0.75)]'
  const label = 'flex flex-col gap-[2px] text-[calc(var(--base)*0.7)] text-[var(--theme-elevation-700)]'
  return (
    <details className="rounded-[3px] border border-[var(--theme-elevation-200)] p-[6px]">
      <summary className="cursor-pointer text-[calc(var(--base)*0.75)]">Folder settings: {record.path}</summary>
      <div className="mt-[6px] flex flex-col gap-[6px]">
        <label className={label}>Colour<input className={input} type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} /></label>
        <label className={label}>Description<textarea className={input} rows={2} maxLength={300} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
        <label className={label}>Alt text starts with (new pictures)<input className={input} maxLength={60} value={draft.altPrefix} onChange={(e) => setDraft({ ...draft, altPrefix: e.target.value })} /></label>
        <label className={label}>Default licence (new files)<input className={input} maxLength={80} value={draft.defaultLicence} onChange={(e) => setDraft({ ...draft, defaultLicence: e.target.value })} /></label>
        {isAdmin ? (
          <>
            <label className={label}>
              Visibility
              <select className={input} value={draft.visibility} onChange={(e) => setDraft({ ...draft, visibility: e.target.value as FolderRecord['visibility'] })}>
                <option value="inherit">Same as the folder above</option>
                <option value="public">Public</option>
                <option value="private">Private (signed-in staff only)</option>
              </select>
            </label>
            <fieldset className={label}>
              <legend>Only these roles may use this folder (none ticked: everyone with media access)</legend>
              {roles.map((r) => (
                <label key={r.value}><input type="checkbox" checked={draft.allowedRoles.includes(r.value)} onChange={() => setDraft({ ...draft, allowedRoles: toggle(draft.allowedRoles, r.value) })} /> {r.label}</label>
              ))}
            </fieldset>
            {companies.length > 0 ? (
              <fieldset className={label}>
                <legend>Or members of these companies</legend>
                {companies.map((c) => (
                  <label key={c.id}><input type="checkbox" checked={draft.allowedCompanies.includes(c.id)} onChange={() => setDraft({ ...draft, allowedCompanies: toggle(draft.allowedCompanies, c.id) })} /> {c.name}</label>
                ))}
              </fieldset>
            ) : null}
          </>
        ) : null}
        <button type="button" className="self-start rounded-[3px] border border-[var(--theme-elevation-200)] px-[8px] py-[3px] hover:border-[var(--ac-gold)]" onClick={() => void save()}>Save folder</button>
        {message ? <p role="status" className="m-0 text-[calc(var(--base)*0.7)]">{message}</p> : null}
      </div>
    </details>
  )
}
