'use client'

import React, { useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import { createEmbed, updateEmbed } from '@/features/forms/embedActions'
import { embedOutputs, parseAllowedOrigins, type EmbedAdminRow } from '@/features/forms/embedAdmin'
import type { EmbedFont, EmbedRadius, EmbedTheme } from '@/features/forms/embeds'

/**
 * External embeds: each embed of a form, its name (the source label of its submissions), its websites, its theme
 * and the address and snippets to place on another website. A form can have several embeds, each with its own
 * address. Theme picks come from the site's own design: colours from the palette, the heading or body font, and
 * the site's corner radius. Changes go through createEmbed and updateEmbed, which check the permission again.
 */

export type ThemeColour = { id: string; name: string }

const noopSubscribe = (): (() => void) => () => undefined
const siteOrigin = (): string => window.location.origin
const RADII: EmbedRadius[] = ['none', 'small', 'medium', 'large']
const FONTS: EmbedFont[] = ['body', 'heading']

function Copy({ text, label, done }: { text: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="ve-btn ve-btn--ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
        } catch {
          setCopied(false)
        }
      }}
    >
      {copied ? done : label}
    </button>
  )
}

/** The three theme pickers. An empty pick means the site's own default, so the embed follows the site. */
function ThemePicks({ theme, onChange, colours, disabled }: { theme: EmbedTheme; onChange: (next: EmbedTheme) => void; colours: ThemeColour[]; disabled: boolean }) {
  const t = useAdminT()
  const radiusLabel: Record<EmbedRadius, string> = {
    none: t('extEmbeds.radiusNone'),
    small: t('extEmbeds.radiusSmall'),
    medium: t('extEmbeds.radiusMedium'),
    large: t('extEmbeds.radiusLarge'),
  }
  const fontLabel: Record<EmbedFont, string> = { body: t('extEmbeds.fontBody'), heading: t('extEmbeds.fontHeading') }
  return (
    <fieldset style={{ border: 0, padding: 0, margin: '0 0 12px' }}>
      <legend style={{ fontWeight: 600 }}>{t('extEmbeds.theme')}</legend>
      <p className="doc-muted">{t('extEmbeds.themeIntro')}</p>
      <label className="ve-field">
        <span>{t('extEmbeds.colour')}</span>
        <select disabled={disabled} value={theme.colour ?? ''} onChange={(e) => onChange({ ...theme, colour: e.target.value || undefined })}>
          <option value="">{t('extEmbeds.siteDefault')}</option>
          {colours.map((colour) => (
            <option key={colour.id} value={colour.id}>
              {colour.name}
            </option>
          ))}
        </select>
      </label>
      <label className="ve-field">
        <span>{t('extEmbeds.font')}</span>
        <select disabled={disabled} value={theme.font ?? ''} onChange={(e) => onChange({ ...theme, font: (e.target.value || undefined) as EmbedFont | undefined })}>
          <option value="">{t('extEmbeds.siteDefault')}</option>
          {FONTS.map((font) => (
            <option key={font} value={font}>
              {fontLabel[font]}
            </option>
          ))}
        </select>
      </label>
      <label className="ve-field">
        <span>{t('extEmbeds.radius')}</span>
        <select disabled={disabled} value={theme.radius ?? ''} onChange={(e) => onChange({ ...theme, radius: (e.target.value || undefined) as EmbedRadius | undefined })}>
          <option value="">{t('extEmbeds.siteDefault')}</option>
          {RADII.map((radius) => (
            <option key={radius} value={radius}>
              {radiusLabel[radius]}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  )
}

function Row({ row, origin, canChange, colours }: { row: EmbedAdminRow; origin: string; canChange: boolean; colours: ThemeColour[] }) {
  const t = useAdminT()
  const router = useRouter()
  const [name, setName] = useState(row.name)
  const [text, setText] = useState(row.allowedOrigins.join('\n'))
  const [theme, setTheme] = useState<EmbedTheme>(row.theme)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const out = origin ? embedOutputs(row.embedKey, origin) : null

  const save = async (enabled: boolean) => {
    const parsed = parseAllowedOrigins(text)
    if (parsed.invalid.length) {
      setError(t('extEmbeds.invalid'))
      return
    }
    setBusy(true)
    setError(null)
    const result = await updateEmbed({ id: row.id, name, enabled, allowedOrigins: parsed.origins, theme })
    setBusy(false)
    if ('error' in result) setError(result.error)
    else router.refresh()
  }

  return (
    <li className="ext-embed" style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: '1rem' }}>
        {row.name} <span className="doc-muted">({row.formTitle}, #{row.formId}, {row.formPublished ? t('extEmbeds.published') : t('extEmbeds.draftStatus')})</span>
      </h3>
      <p>
        {t('extEmbeds.embedding')}: <strong>{row.enabled ? t('extEmbeds.on') : t('extEmbeds.off')}</strong>
        {!row.formPublished && <span className="doc-muted"> {t('extEmbeds.draftNote')}</span>}
      </p>
      {out ? (
        <>
          <label className="ve-field ve-field--full">
            <span>{t('extEmbeds.hostedUrl')}</span>
            <input readOnly value={out.hostedUrl} onFocus={(e) => e.currentTarget.select()} />
          </label>
          <label className="ve-field ve-field--full">
            <span>{t('extEmbeds.scriptSnippet')}</span>
            <textarea readOnly rows={2} value={out.scriptSnippet} onFocus={(e) => e.currentTarget.select()} />
          </label>
          <p>
            <Copy text={out.scriptSnippet} label={t('extEmbeds.copyScript')} done={t('extEmbeds.copied')} />
          </p>
          <label className="ve-field ve-field--full">
            <span>{t('extEmbeds.iframeSnippet')}</span>
            <textarea readOnly rows={3} value={out.iframeSnippet} onFocus={(e) => e.currentTarget.select()} />
          </label>
          <p>
            <Copy text={out.iframeSnippet} label={t('extEmbeds.copyIframe')} done={t('extEmbeds.copied')} />
          </p>
        </>
      ) : null}
      <label className="ve-field ve-field--full">
        <span>{t('extEmbeds.name')}</span>
        <input value={name} disabled={!canChange} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </label>
      <p className="doc-muted">{t('extEmbeds.source')}</p>
      <ThemePicks theme={theme} onChange={setTheme} colours={colours} disabled={!canChange} />
      <label className="ve-field ve-field--full">
        <span>{t('extEmbeds.domains')}</span>
        <textarea rows={3} value={text} disabled={!canChange} onChange={(e) => setText(e.target.value)} />
      </label>
      <p className="doc-muted">{row.allowedOrigins.length === 0 ? t('extEmbeds.anyWebsite') : t('extEmbeds.onlyThese')}</p>
      {canChange && (
        <p style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn--primary" disabled={busy} onClick={() => save(row.enabled)}>
            {t('extEmbeds.save')}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => save(!row.enabled)}>
            {row.enabled ? t('extEmbeds.disable') : t('extEmbeds.enable')}
          </button>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </li>
  )
}

export function ExternalEmbedsPanel({ rows, canChange, colours }: { rows: EmbedAdminRow[]; canChange: boolean; colours: ThemeColour[] }) {
  const t = useAdminT()
  const origin = useSyncExternalStore(noopSubscribe, siteOrigin, () => '')
  if (rows.length === 0) return null
  return (
    <div>
      <p className="doc-muted">{t('extEmbeds.intro')}</p>
      {!canChange && <p className="doc-muted">{t('extEmbeds.readOnly')}</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {rows.map((row) => (
          <Row key={String(row.id)} row={row} origin={origin} canChange={canChange} colours={colours} />
        ))}
      </ul>
    </div>
  )
}

/** Create: a new embed of a form, switched on, with its websites and theme. Each form can have several. */
export function NewEmbedForm({ forms, colours }: { forms: { id: number; title: string }[]; colours: ThemeColour[] }) {
  const t = useAdminT()
  const router = useRouter()
  const [formId, setFormId] = useState<string>(forms[0] ? String(forms[0].id) : '')
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [theme, setTheme] = useState<EmbedTheme>({})
  const [error, setError] = useState<string | null>(null)
  if (forms.length === 0) return null
  const create = async () => {
    const parsed = parseAllowedOrigins(text)
    if (parsed.invalid.length) return setError(t('extEmbeds.invalid'))
    const result = await createEmbed({ formId, name, allowedOrigins: parsed.origins, theme })
    if ('error' in result) setError(result.error)
    else router.refresh()
  }
  return (
    <section aria-label={t('extEmbeds.newTitle')} style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: '1rem' }}>{t('extEmbeds.newTitle')}</h2>
      <label className="ve-field">
        <span>{t('extEmbeds.pickForm')}</span>
        <select value={formId} onChange={(e) => setFormId(e.target.value)}>
          {forms.map((form) => (
            <option key={form.id} value={String(form.id)}>
              {form.title} (#{form.id})
            </option>
          ))}
        </select>
      </label>
      <label className="ve-field ve-field--full">
        <span>{t('extEmbeds.name')}</span>
        <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </label>
      <p className="doc-muted">{t('extEmbeds.source')}</p>
      <ThemePicks theme={theme} onChange={setTheme} colours={colours} disabled={false} />
      <label className="ve-field ve-field--full">
        <span>{t('extEmbeds.domains')}</span>
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <p>
        <button type="button" className="btn btn--primary" onClick={create}>
          {t('extEmbeds.create')}
        </button>
      </p>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
