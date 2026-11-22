'use client'

import { useState } from 'react'

import { applyClonedTheme, type ClonedTheme } from '@/features/themeStyles/cloneSite'
import type { ThemeStyles } from '@/features/themeStyles/types'

type Props = { styles: ThemeStyles; onChange: (next: ThemeStyles) => void; onNotice: (text: string) => void }

/**
 * Clone from a website (Task 14, 33e): paste an address, see the colours, fonts and corner radius found on the page,
 * tick what to keep, and apply it to the editor. Nothing is saved until Save changes. The reading is done by counting the
 * page's CSS, with no outside service; once an AI provider is connected a later step can ask what you like about the site.
 */
export function CloneThemeControls({ styles, onChange, onNotice }: Props) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [found, setFound] = useState<{ host: string; theme: ClonedTheme } | null>(null)
  const [colours, setColours] = useState<string[]>([])
  const [radius, setRadius] = useState(true)

  const read = async () => {
    setBusy(true)
    setError('')
    setFound(null)
    try {
      const res = await fetch('/api/admin-theme-clone', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
      const json = (await res.json().catch((): { ok?: boolean; error?: string } => ({}))) as { ok?: boolean; error?: string; host?: string; theme?: ClonedTheme }
      if (!res.ok || json.ok === false || !json.theme) setError(json.error || 'The site could not be read.')
      else {
        setFound({ host: json.host ?? '', theme: json.theme })
        setColours(json.theme.colours.map((c) => c.id))
        setRadius(json.theme.radius !== null)
      }
    } catch {
      setError('The site could not be read.')
    }
    setBusy(false)
  }

  const apply = () => {
    if (!found) return
    onChange(applyClonedTheme(styles, found.theme, { colours, radius }))
    onNotice(`Colours from ${found.host} applied to the editor. Review the preview, then choose Save changes.`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p className="ts-help">Paste the address of a site whose look you like. We read its public page and stylesheets and propose a palette. Nothing is copied except colours and corner radius, and nothing changes until you apply and save.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input type="url" aria-label="Website address" placeholder="https://example.com" value={url} onChange={(event) => setUrl(event.target.value)} style={{ minWidth: 260 }} />
        <button type="button" className="ts-btn ts-btn--primary" disabled={busy || !url.trim()} onClick={() => void read()}>{busy ? 'Reading...' : 'Read site'}</button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      {found ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p role="status">{found.theme.note}</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
            {found.theme.colours.map((c) => (
              <li key={c.id}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={colours.includes(c.id)} onChange={(event) => setColours(event.target.checked ? [...colours, c.id] : colours.filter((id) => id !== c.id))} />
                  <span aria-hidden="true" style={{ width: 24, height: 24, background: c.value, border: '1px solid #8886', display: 'inline-block' }} />
                  <span>{c.label}: {c.value} (used {c.uses} times)</span>
                </label>
              </li>
            ))}
          </ul>
          {found.theme.radius !== null ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={radius} onChange={(event) => setRadius(event.target.checked)} /> Corner radius {found.theme.radius}px on buttons and fields
            </label>
          ) : null}
          {found.theme.headingFont || found.theme.bodyFont ? (
            <p className="ts-help">Fonts seen: {[found.theme.headingFont && `headings ${found.theme.headingFont}`, found.theme.bodyFont && `body ${found.theme.bodyFont}`].filter(Boolean).join(', ')}. Add them in Site fonts, then pick them on the Typography tab (fonts are never copied from another site).</p>
          ) : null}
          <div><button type="button" className="ts-btn ts-btn--primary" disabled={colours.length === 0 && !radius} onClick={apply}>Apply to the editor</button></div>
        </div>
      ) : null}
    </div>
  )
}
