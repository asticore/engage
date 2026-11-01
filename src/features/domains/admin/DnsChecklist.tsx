'use client'

import React, { useEffect, useState } from 'react'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import { dnsChecklistFor, dnsHintFor, type ChecklistDomain } from '@/features/domains/checklist'

/**
 * The per-domain DNS and Worker hints, with the full checklist as text that can be selected and copied. Nothing is
 * checked against Cloudflare; the hint says so on each row.
 */
export function DnsChecklist() {
  const [domains, setDomains] = useState<ChecklistDomain[] | null>(null)
  const [configured, setConfigured] = useState(false)
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const t = useAdminT()

  useEffect(() => {
    let alive = true
    fetch('/api/admin-domain-list', { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((json: { domains?: ChecklistDomain[]; attachConfigured?: boolean } | null) => {
        if (!alive) return
        setDomains(json?.domains ?? [])
        setConfigured(Boolean(json?.attachConfigured))
      })
      .catch(() => {
        if (alive) setDomains([])
      })
    return () => {
      alive = false
    }
  }, [])

  const list = domains ?? []
  const text = dnsChecklistFor(list, t)

  // Connect domain: attaches the host to the Worker through the Cloudflare API when the Integrations settings are complete.
  const connect = async (host: string) => {
    setBusy(host)
    try {
      const response = await fetch('/api/admin-domain-attach', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ host }),
      })
      const json = (await response.json().catch((): null => null)) as { ok?: boolean; message?: string; reason?: string } | null
      const message = json?.ok
        ? t('dns.connectDone')
        : json?.reason === 'not-configured'
          ? t('dns.connectNeedsSetup')
          : t('dns.connectFailed', { message: json?.message ?? `HTTP ${response.status}` })
      setMessages((current) => ({ ...current, [host]: message }))
    } catch {
      setMessages((current) => ({ ...current, [host]: t('dns.connectFailed', { message: 'network' }) }))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {list.map((domain) => (
        <div key={domain.host} style={{ display: 'grid', gap: 2 }}>
          <strong>{domain.host}</strong>
          <span style={{ opacity: 0.8 }}>{dnsHintFor(domain, t)}</span>
          {domain.status === 'disabled' ? null : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {configured ? (
                <button type="button" disabled={busy === domain.host} onClick={() => connect(domain.host)}>
                  {busy === domain.host ? t('dns.connecting') : t('dns.connect')}
                </button>
              ) : (
                <span style={{ opacity: 0.8 }}>{t('dns.connectManual')}</span>
              )}
            </div>
          )}
          {messages[domain.host] ? <span role="status">{messages[domain.host]}</span> : null}
        </div>
      ))}
      <textarea readOnly rows={Math.min(16, text.split('\n').length + 1)} value={text} onFocus={(event) => event.target.select()} style={{ width: '100%', fontFamily: 'monospace' }} />
    </div>
  )
}

export default DnsChecklist
