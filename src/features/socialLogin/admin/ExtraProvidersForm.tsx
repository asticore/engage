'use client'

import React, { useState } from 'react'

import { saveExtraProviderAction, saveOneTapAction } from '../extraActions'

/**
 * Settings > Security > More sign-in providers: one card per provider that is stored apart from the
 * Security settings page, plus the Google One Tap switch. Secrets are never sent to the browser: a
 * saved secret shows as "saved" and a blank field keeps it.
 */

export type ExtraCard = {
  id: string
  label: string
  enabled: boolean
  clientId: string
  hasSecret: boolean
  redirectConfirmed: boolean
  idLabel: string
  secretLabel: string
  redirectUri: string
  guide: { consoleUrl: string; consoleLabel: string; scopes: string[]; steps: string[]; notes: string[] }
  settings: Record<string, string | boolean>
  /** Test sign-in outcome sentence, when this page was just returned to from a test. */
  testNote: string | null
}

const box: React.CSSProperties = { border: '1px solid rgba(128,128,128,0.4)', borderRadius: 6, padding: '0.75rem 1rem', margin: '0 0 1.25rem', display: 'grid', gap: '0.5rem' }
const field: React.CSSProperties = { display: 'grid', gap: '0.25rem' }

const OIDC_FIELDS: Array<[string, string, string]> = [
  ['label', 'Button text', 'Sign in with Acme'],
  ['discoveryUrl', 'Discovery URL', 'https://login.example.com/.well-known/openid-configuration'],
  ['authUrl', 'Authorize URL (only if there is no discovery URL)', ''],
  ['tokenUrl', 'Token URL (only if there is no discovery URL)', ''],
  ['userinfoUrl', 'User info URL (optional)', ''],
  ['scopes', 'Scopes (blank means openid email profile)', 'openid email profile'],
  ['subjectClaim', 'Subject claim (blank means sub)', 'sub'],
  ['emailClaim', 'Email claim (blank means email)', 'email'],
  ['verifiedClaim', 'Email verified claim (blank means email_verified)', 'email_verified'],
]

function ProviderCard({ card }: { card: ExtraCard }): React.ReactElement {
  const [values, setValues] = useState<Record<string, string | boolean>>({
    enabled: card.enabled,
    clientId: card.clientId,
    clientSecret: '',
    redirectConfirmed: card.redirectConfirmed,
    trustEmail: card.settings.trustEmail === true,
    ...Object.fromEntries(OIDC_FIELDS.map(([key]) => [key, String(card.settings[key] ?? '')])),
  })
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const set = (key: string, value: string | boolean): void => setValues((v) => ({ ...v, [key]: value }))

  const save = async (): Promise<void> => {
    setBusy(true)
    const result = await saveExtraProviderAction(card.id, values).catch((): { ok: boolean; message: string } => ({ ok: false, message: 'That could not be saved just now. Try again.' }))
    setNote(result.message)
    if (result.ok) set('clientSecret', '')
    setBusy(false)
  }
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(card.redirectUri)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }
  const text = (key: string, label: string, placeholder = '', type = 'text'): React.ReactElement => (
    <label style={field} key={key}>
      <span>{label}</span>
      <input type={type} value={String(values[key] ?? '')} placeholder={placeholder} onChange={(e) => set(key, e.target.value)} autoComplete="off" />
    </label>
  )

  return (
    <section style={box} id={`provider-${card.id}`} data-testid={`extra-provider-${card.id}`}>
      <h2 style={{ margin: 0 }}>{card.label}</h2>
      {card.testNote ? <p role="status">{card.testNote}</p> : null}
      <details>
        <summary>Setup guide</summary>
        <p>
          <a href={card.guide.consoleUrl} target="_blank" rel="noreferrer">
            {card.guide.consoleLabel}
          </a>
          . Scopes asked for: <code>{card.guide.scopes.join(' ')}</code>
        </p>
        <ol>
          {card.guide.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {card.guide.notes.map((n) => (
          <p key={n}>
            <small>{n}</small>
          </p>
        ))}
      </details>
      <div>
        Redirect URL to add in the provider console: <code>{card.redirectUri}</code>{' '}
        <button type="button" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {card.id === 'oidc' ? OIDC_FIELDS.map(([key, label, placeholder]) => text(key, label, placeholder)) : null}
      {text('clientId', card.idLabel)}
      <label style={field}>
        <span>{card.secretLabel}</span>
        <input type="password" value={String(values.clientSecret)} placeholder={card.hasSecret ? 'Saved - leave blank to keep it' : ''} onChange={(e) => set('clientSecret', e.target.value)} autoComplete="new-password" />
      </label>
      {card.id === 'oidc' ? (
        <label>
          <input type="checkbox" checked={values.trustEmail === true} onChange={(e) => set('trustEmail', e.target.checked)} /> Trust the email address even when the provider does not say it is verified
        </label>
      ) : null}
      <label>
        <input type="checkbox" checked={values.redirectConfirmed === true} onChange={(e) => set('redirectConfirmed', e.target.checked)} /> I have added the redirect URL in the provider console
      </label>
      <label>
        <input type="checkbox" checked={values.enabled === true} onChange={(e) => set('enabled', e.target.checked)} /> Allow sign-in with {card.label}
      </label>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" onClick={save} disabled={busy}>
          Save
        </button>
        {/* Testing uses the saved settings, so save first. */}
        <a href={`/api/social/${card.id}/start?mode=test&area=admin`}>Test sign-in (uses the saved settings)</a>
        {note ? <span role="status">{note}</span> : null}
      </div>
    </section>
  )
}

export function ExtraProvidersForm({ cards, oneTap, googleReady }: { cards: ExtraCard[]; oneTap: boolean; googleReady: boolean }): React.ReactElement {
  const [on, setOn] = useState(oneTap)
  const [note, setNote] = useState('')
  const toggle = async (next: boolean): Promise<void> => {
    const result = await saveOneTapAction(next).catch((): { ok: boolean; message: string } => ({ ok: false, message: 'That could not be saved just now. Try again.' }))
    if (result.ok) setOn(next)
    setNote(result.message)
  }
  return (
    <div>
      <section style={box} id="google-one-tap" data-testid="google-one-tap">
        <h2 style={{ margin: 0 }}>Google One Tap</h2>
        <p style={{ margin: 0 }}>
          Shows Google&apos;s one-tap sign-in prompt on the member sign-in page for visitors who are signed in to Google. It uses the Google client ID from Settings &gt; Security &gt; Social login and follows
          the same rules as the Google button (no staff accounts, no unverified emails). If you set a Content Security Policy, allow <code>https://accounts.google.com/gsi/</code>.
        </p>
        <label>
          <input type="checkbox" checked={on} disabled={!googleReady && !on} onChange={(e) => void toggle(e.target.checked)} /> Show Google One Tap on the sign-in page
        </label>
        {!googleReady ? <small>Switch on Google sign-in first.</small> : null}
        {note ? <small role="status">{note}</small> : null}
      </section>
      {cards.map((card) => (
        <ProviderCard key={card.id} card={card} />
      ))}
    </div>
  )
}
