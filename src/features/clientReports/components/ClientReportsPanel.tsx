'use client'

import React, { useCallback, useEffect, useState } from 'react'

import type { Cadence, Preset, SectionKey } from '../core'

type Row = { id: number; name: string; preset: Preset; recipients: string; cadence: Cadence; lastSentAt: string | null; revoked: boolean; link: string; sections: SectionKey[]; rangeFrom: string; rangeTo: string }
type Loaded = { reports: Row[]; presets: { value: Preset; label: string }[]; cadences: { value: Cadence; label: string }[]; sections: { value: SectionKey; label: string }[] }

/** Admin screen for client reports: make read-only links, set the email schedule, download CSV. English only. */
export const ClientReportsPanel: React.FC = () => {
  const [data, setData] = useState<Loaded | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [preset, setPreset] = useState<Preset>('30d')
  const [recipients, setRecipients] = useState('')
  const [cadence, setCadence] = useState<Cadence>('none')
  const [sections, setSections] = useState<SectionKey[]>([])
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin-client-reports')
    const out = (await res.json().catch((): null => null)) as (Loaded & { error?: string }) | null
    if (!res.ok || !out) return setMessage(out?.error ?? 'Could not load the reports.')
    setData(out)
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (body: Record<string, unknown>, ok: string): Promise<boolean> => {
    setBusy(true)
    const res = await fetch('/api/admin-client-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const out = (await res.json().catch((): null => null)) as { error?: string; message?: string } | null
    setBusy(false)
    setMessage(res.ok ? (out?.message ?? ok) : (out?.error ?? 'That did not work.'))
    if (res.ok) await load()
    return res.ok
  }

  const copy = async (row: Row) => {
    await navigator.clipboard?.writeText(row.link).then(() => setMessage(`Link for ${row.name} copied.`)).catch(() => setMessage(row.link))
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {message && <p role="status">{message}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void post({ action: 'create', name, preset, recipients, cadence, sections, rangeFrom, rangeTo }, 'Report created.').then((ok) => {
            if (ok) {
              setName('')
              setRecipients('')
              setCadence('none')
              setSections([])
            }
          })
        }}
        style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}
      >
        <label>Report name<br /><input type="text" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Period<br />
          <select value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
            {(data?.presets ?? []).map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </label>
        {preset === 'custom' && (
          <>
            <label>From<br /><input type="date" required value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} /></label>
            <label>To<br /><input type="date" required value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} /></label>
          </>
        )}
        <fieldset style={{ border: 0, padding: 0 }}>
          <legend>Sections (none ticked shows all)</legend>
          {(data?.sections ?? []).map((sec) => (
            <label key={sec.value} style={{ marginRight: '0.75rem' }}>
              <input type="checkbox" checked={sections.includes(sec.value)} onChange={(e) => setSections(e.target.checked ? [...sections, sec.value] : sections.filter((v) => v !== sec.value))} /> {sec.label}
            </label>
          ))}
        </fieldset>
        <label>Email to (commas between addresses)<br /><input type="text" value={recipients} onChange={(e) => setRecipients(e.target.value)} /></label>
        <label>Email schedule<br />
          <select value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)}>
            {(data?.cadences ?? []).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <button type="submit" disabled={busy}>Create report</button>
      </form>

      {data && data.reports.length === 0 && <p>No reports yet. Make one above, then copy its link for the client.</p>}
      {data && data.reports.length > 0 && (
        <table>
          <thead>
            <tr><th scope="col">Report</th><th scope="col">Period</th><th scope="col">Emails</th><th scope="col">Link</th><th scope="col">Actions</th></tr>
          </thead>
          <tbody>
            {data.reports.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.preset === 'custom' ? `${r.rangeFrom} to ${r.rangeTo}` : data.presets.find((p) => p.value === r.preset)?.label}{r.sections.length > 0 ? ` (${r.sections.map((v) => data.sections.find((x) => x.value === v)?.label ?? v).join(', ')})` : ''}</td>
                <td>{r.recipients ? `${data.cadences.find((c) => c.value === r.cadence)?.label}: ${r.recipients}` : 'No recipients'}{r.lastSentAt ? ` (last sent ${new Date(r.lastSentAt).toLocaleDateString()})` : ''}</td>
                <td>{r.revoked ? 'Link switched off' : 'Read-only link active'}</td>
                <td style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" disabled={busy || r.revoked} onClick={() => void copy(r)}>Copy link</button>
                  <a href={`/api/admin-client-reports?csv=${r.id}`} download>CSV</a>
                  <button type="button" disabled={busy || !r.recipients} onClick={() => void post({ action: 'send', id: r.id }, 'Sent.')}>Email now</button>
                  <button type="button" disabled={busy} onClick={() => void post({ action: r.revoked ? 'restore' : 'revoke', id: r.id }, r.revoked ? 'Link switched on.' : 'Link switched off.')}>{r.revoked ? 'Switch link on' : 'Switch link off'}</button>
                  <button type="button" disabled={busy} onClick={() => void post({ action: 'rotate', id: r.id }, 'New link made. The old one no longer works.')}>New link</button>
                  <button type="button" disabled={busy} onClick={() => void post({ action: 'delete', id: r.id }, 'Report deleted.')}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
