'use client'

import { useCallback, useEffect, useState } from 'react'

import { describeColourOverrides, sanitizeThemeOverrides, NO_THEME_OVERRIDES, type ThemeOverrides } from '@/features/themeStyles/inherit'
import type { ThemeColour, ThemeStyles } from '@/features/themeStyles/types'

type DomainRow = { host: string; label: string; overrides: ThemeOverrides | null }
type Listing = { ok?: boolean; error?: string; master?: string | null; domains?: DomainRow[]; colours?: ThemeColour[] }

type Props = { styles: ThemeStyles }

/**
 * Domain themes (Task 14, 33e): the primary domain's theme is the master; every other domain inherits all of it and
 * overrides only the colours, fonts and corner radii chosen here. Each overridden value says so, and Reset returns it
 * to the master. Saved separately from the master theme, per domain.
 */
export function DomainThemeControls({ styles }: Props) {
  const [listing, setListing] = useState<Listing | null>(null)
  const [host, setHost] = useState('')
  const [draft, setDraft] = useState<ThemeOverrides>(NO_THEME_OVERRIDES)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    fetch('/api/admin-theme-domains', { credentials: 'include' })
      .then(async (res) => (await res.json().catch((): Listing => ({ ok: false, error: 'Could not load domains.' }))) as Listing)
      .then((json) => {
        if (!live) return
        setListing(json)
        const first = json.domains?.[0]
        if (first) {
          setHost(first.host)
          setDraft(sanitizeThemeOverrides(first.overrides))
        }
      })
      .catch((): void => {
        if (live) setListing({ ok: false, error: 'Could not load domains.' })
      })
    return () => {
      live = false
    }
  }, [])

  const choose = (next: string) => {
    setHost(next)
    setMessage('')
    setDraft(sanitizeThemeOverrides(listing?.domains?.find((d) => d.host === next)?.overrides))
  }

  const setColour = useCallback((id: string, key: 'value' | 'darkValue', value: string) => {
    setDraft((current) => {
      const colours = { ...current.colours }
      const entry = { ...(colours[id] ?? {}) }
      if (value.trim() === '') delete entry[key]
      else entry[key] = value.trim()
      if (entry.value === undefined && entry.darkValue === undefined) delete colours[id]
      else colours[id] = entry
      return { ...current, colours }
    })
  }, [])

  const save = async () => {
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin-theme-domains', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host, overrides: draft }) })
      const json = (await res.json().catch((): { ok?: boolean; error?: string; overrides?: ThemeOverrides } => ({}))) as { ok?: boolean; error?: string; overrides?: ThemeOverrides }
      if (!res.ok || json.ok === false) setMessage(json.error || 'Could not save.')
      else {
        const saved = sanitizeThemeOverrides(json.overrides)
        setDraft(saved)
        setListing((current) => (current ? { ...current, domains: current.domains?.map((d) => (d.host === host ? { ...d, overrides: saved } : d)) } : current))
        setMessage(`Saved the theme for ${host}.`)
      }
    } catch {
      setMessage('Could not save.')
    }
    setBusy(false)
  }

  if (!listing) return <p className="ts-help">Loading domains...</p>
  if (listing.ok === false) return <p role="alert">{listing.error}</p>
  if (!listing.master) return <p className="ts-help">Set a primary domain in Settings, Domains first. Its theme becomes the master that other domains inherit.</p>
  if (!listing.domains?.length) return <p className="ts-help">Only {listing.master} is registered. Add another domain in Settings, Domains and it inherits this theme, with its own overrides.</p>

  const rows = describeColourOverrides(styles, draft)
  const overriddenCount = rows.filter((r) => r.overridden).length + (draft.headingFont ? 1 : 0) + (draft.bodyFont ? 1 : 0) + (draft.buttonRadius !== null ? 1 : 0) + (draft.fieldRadius !== null ? 1 : 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p className="ts-help">
        <strong>{listing.master}</strong> is the master theme (the one on the other tabs). Pick a domain: it inherits everything and you change only what should differ.
        Unsaved master edits show here, but overrides are saved with their own button.
      </p>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 320 }}>
        Domain
        <select value={host} onChange={(event) => choose(event.target.value)}>
          {listing.domains.map((d) => (
            <option key={d.host} value={d.host}>{d.label ? `${d.label} (${d.host})` : d.host}</option>
          ))}
        </select>
      </label>
      <table className="ts-table" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr><th align="left">Colour</th><th align="left">Value</th><th align="left">Dark value</th><th align="left">State</th><th /></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td><input aria-label={`${row.name} value for ${host}`} value={row.overridden && draft.colours[row.id]?.value !== undefined ? row.value : ''} placeholder={row.inherited} onChange={(event) => setColour(row.id, 'value', event.target.value)} style={{ width: 110 }} /></td>
              <td><input aria-label={`${row.name} dark value for ${host}`} value={draft.colours[row.id]?.darkValue ?? ''} placeholder={row.inheritedDark || row.inherited} onChange={(event) => setColour(row.id, 'darkValue', event.target.value)} style={{ width: 110 }} /></td>
              <td>{row.overridden ? <strong>Overridden</strong> : 'Inherited'}</td>
              <td>{row.overridden ? <button type="button" className="ts-btn" onClick={() => { setColour(row.id, 'value', ''); setColour(row.id, 'darkValue', '') }}>Reset</button> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          Button corner radius (px)
          <input type="number" min={0} max={64} placeholder="inherited" value={draft.buttonRadius ?? ''} onChange={(event) => setDraft({ ...draft, buttonRadius: event.target.value === '' ? null : Number(event.target.value) })} style={{ width: 120 }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          Form field corner radius (px)
          <input type="number" min={0} max={64} placeholder="inherited" value={draft.fieldRadius ?? ''} onChange={(event) => setDraft({ ...draft, fieldRadius: event.target.value === '' ? null : Number(event.target.value) })} style={{ width: 120 }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          Heading font id
          <input placeholder="inherited" value={draft.headingFont} onChange={(event) => setDraft({ ...draft, headingFont: event.target.value })} style={{ width: 140 }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          Body font id
          <input placeholder="inherited" value={draft.bodyFont} onChange={(event) => setDraft({ ...draft, bodyFont: event.target.value })} style={{ width: 140 }} />
        </label>
      </div>
      <p className="ts-help">{overriddenCount === 0 ? `${host} inherits the whole master theme.` : `${overriddenCount} value${overriddenCount === 1 ? '' : 's'} overridden for ${host}.`}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="ts-btn ts-btn--primary" disabled={busy} onClick={() => void save()}>Save domain theme</button>
        <button type="button" className="ts-btn" disabled={busy} onClick={() => setDraft(NO_THEME_OVERRIDES)}>Inherit everything</button>
      </div>
      {message ? <p role="status">{message}</p> : null}
    </div>
  )
}
