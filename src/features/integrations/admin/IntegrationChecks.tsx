'use client'

import React, { useState } from 'react'
import { useFormFields, useFormModified } from '@/engine/ui'
import { analyticsIdProblems } from '../analyticsIds'

/**
 * The "Check" buttons on the Integrations page. Each one is a question the
 * provider answers without changing anything, or a format check that never
 * leaves the browser.
 */

const MESSAGE_STYLE = (ok: boolean): React.CSSProperties => ({
  marginLeft: 8,
  color: ok ? 'var(--theme-success-500, #2e7d32)' : 'var(--theme-error-500, #c62828)',
})

/** Format check of the Google, Clarity, Meta and TikTok IDs as typed on this page. Sends nothing. */
export const CheckAnalyticsIdsButton: React.FC = () => {
  const ga4 = useFormFields(([fields]) => fields?.['google.ga4MeasurementId']?.value)
  const gtm = useFormFields(([fields]) => fields?.['google.gtmContainerId']?.value)
  const clarity = useFormFields(([fields]) => fields?.['clarity.projectId']?.value)
  const meta = useFormFields(([fields]) => fields?.['metaPixel.pixelId']?.value)
  const tiktok = useFormFields(([fields]) => fields?.['tiktokPixel.pixelId']?.value)
  const [messages, setMessages] = useState<string[] | null>(null)

  const run = () => {
    const problems = analyticsIdProblems({
      ga4MeasurementId: ga4,
      gtmContainerId: gtm,
      clarityProjectId: clarity,
      metaPixelId: meta,
      tiktokPixelId: tiktok,
    })
    setMessages(problems.length ? problems.map((p) => p.message) : ['The IDs filled in here look right. Nothing was sent to the services.'])
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <button type="button" className="btn btn--style-secondary btn--size-small" onClick={run}>
        Check ID format
      </button>
      <span style={{ marginLeft: 8, opacity: 0.7 }}>Checks the typed IDs only. Nothing is sent to Google, Microsoft, Meta or TikTok.</span>
      {messages?.map((text) => (
        <div key={text} role="status" style={MESSAGE_STYLE(messages.length === 1 && text.startsWith('The IDs'))}>
          {text}
        </div>
      ))}
    </div>
  )
}

type RemoteProps = { check: 'ai' | 'cloudflare' | 'maps' | 'pagespeed' | 'recaptcha'; label: string; hint: string }

const RemoteCheck: React.FC<RemoteProps> = ({ check, label, hint }) => {
  const modified = useFormModified()
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<Array<{ ok: boolean; text: string }> | null>(null)

  const run = async () => {
    setBusy(true)
    setMessages(null)
    try {
      const response = await fetch('/api/admin-integration-checks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ check }),
      })
      const body = (await response.json().catch((): null => null)) as Record<string, { ok?: boolean; message?: string }> | { ok?: boolean; message?: string; error?: string } | null
      if (!response.ok || !body) {
        setMessages([{ ok: false, text: (body as { error?: string } | null)?.error ?? 'The check could not run.' }])
      } else if ('message' in body) {
        setMessages([{ ok: Boolean(body.ok), text: String(body.message ?? '') }])
      } else {
        setMessages(
          Object.values(body)
            .filter((r): r is { ok?: boolean; message?: string } => Boolean(r))
            .map((r) => ({ ok: Boolean(r.ok), text: String(r.message ?? '') })),
        )
      }
    } catch {
      setMessages([{ ok: false, text: 'Could not reach the server.' }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <button type="button" className="btn btn--style-secondary btn--size-small" onClick={run} disabled={busy || modified}>
        {busy ? 'Checking...' : label}
      </button>
      <span style={{ marginLeft: 8, opacity: 0.7 }}>{modified ? 'Save first, then check. The check uses the saved values.' : hint}</span>
      {messages?.map((m) => (
        <div key={m.text} role="status" style={MESSAGE_STYLE(m.ok)}>
          {m.text}
        </div>
      ))}
    </div>
  )
}

/** Sends a read-only request to Anthropic and OpenAI for the saved keys. */
export const CheckAiKeysButton: React.FC = () => (
  <RemoteCheck check="ai" label="Check AI keys" hint="Asks each provider for its model list. Nothing is generated and nothing is charged." />
)

/** Reads the saved Cloudflare zone with the saved token. */
export const CheckCloudflareButton: React.FC = () => (
  <RemoteCheck check="cloudflare" label="Check Cloudflare zone" hint="Reads the zone name. Nothing is purged or changed." />
)

/** Offline shape check of the Search Console verification code as typed on this page. Sends nothing. */
export const CheckSearchConsoleButton: React.FC = () => {
  const code = useFormFields(([fields]) => fields?.['google.searchConsoleVerification']?.value)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const run = () => {
    const value = typeof code === 'string' ? code.trim() : ''
    if (!value) setMessage({ ok: false, text: 'No verification code typed yet.' })
    else if (!/^[A-Za-z0-9_-]{20,100}$/.test(value)) {
      setMessage({ ok: false, text: 'The code should be letters, digits, "-" or "_" only. Copy the content value of the meta tag, not the whole tag.' })
    } else {
      setMessage({ ok: true, text: 'The code looks right. Nothing was sent to Google. Google reads the tag on your homepage when you press Verify in Search Console.' })
    }
  }
  return (
    <div style={{ marginBottom: 16 }}>
      <button type="button" className="btn btn--style-secondary btn--size-small" onClick={run}>
        Check code format
      </button>
      <span style={{ marginLeft: 8, opacity: 0.7 }}>Checks the typed code only. Nothing is sent to Google.</span>
      {message && (
        <div role="status" style={MESSAGE_STYLE(message.ok)}>
          {message.text}
        </div>
      )}
    </div>
  )
}

/** Shape check and a read-only call for the saved Google Maps key. */
export const CheckMapsButton: React.FC = () => (
  <RemoteCheck check="maps" label="Check Maps key" hint="Checks the saved key's shape only. Website-restricted keys cannot be tested from the server." />
)

/** One call to PageSpeed Insights with no page address: a key check that runs no test. */
export const CheckPageSpeedButton: React.FC = () => (
  <RemoteCheck check="pagespeed" label="Check PageSpeed key" hint="Asks Google to accept the key. No speed test runs and no test quota is used." />
)

/** The reCAPTCHA site key (shape) and secret key (a siteverify call with a made-up token). */
export const CheckRecaptchaButton: React.FC = () => (
  <RemoteCheck check="recaptcha" label="Check reCAPTCHA keys" hint="Checks the site key's shape and asks Google to accept the secret key. No visitor is checked and nothing is recorded." />
)
