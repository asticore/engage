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

type RemoteProps = { check: 'ai' | 'cloudflare'; label: string; hint: string }

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
