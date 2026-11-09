'use client'

import React, { useState } from 'react'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import { usePortalText } from '@/features/accounts/components/PortalText'

import { createApiKeyForUserAction } from '../actions'

/**
 * Admin screen block: make a key for a customer. The key is tied to the customer's account and limited
 * by their access category; it is shown here once for the admin to hand over. Scopes are chosen the quick
 * way (read everything, or everything); the customer's category narrows them either way.
 */
export const ApiKeyForCustomer: React.FC<{ onCreated?: () => void }> = ({ onCreated }) => {
  const t = useAdminT()
  const tx = usePortalText()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [write, setWrite] = useState(false)
  const [expiry, setExpiry] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [revealed, setRevealed] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const create = async () => {
    setBusy(true)
    setNotice(null)
    const result = await createApiKeyForUserAction({ email, name, scopes: write ? ['*'] : ['*:read'], expiresInDays: expiry, password, code })
    setBusy(false)
    if (result.ok && result.key) {
      setRevealed(result.key)
      setNotice({ tone: 'ok', text: t('apiKeys.forUser.created') })
      setPassword('')
      setCode('')
      setName('')
      onCreated?.()
    } else {
      setNotice({ tone: 'error', text: result.error ?? t('apiKeys.forUser.failed') })
    }
  }

  return (
    <section style={{ display: 'grid', gap: '0.5rem' }}>
      <h2>{t('apiKeys.forUser.heading')}</h2>
      <p>{t('apiKeys.forUser.intro')}</p>
      {notice && <p role="status">{notice.text}</p>}
      {revealed && (
        <div>
          <code style={{ wordBreak: 'break-all' }}>{revealed}</code>{' '}
          <button type="button" onClick={() => void navigator.clipboard?.writeText(revealed)}>
            {tx('panel.akCopy')}
          </button>{' '}
          <button type="button" onClick={() => setRevealed(null)}>
            {tx('panel.akCopied')}
          </button>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void create()
        }}
        style={{ display: 'grid', gap: '0.5rem' }}
      >
        <label>
          {t('apiKeys.forUser.email')} <input type="email" value={email} required onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          {tx('panel.akName')} <input value={name} maxLength={80} required onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          <input type="checkbox" checked={write} onChange={(e) => setWrite(e.target.checked)} /> {tx('panel.akAll')} (<code>*</code>)
        </label>
        <label>
          {tx('panel.akExpiry')} <input value={expiry} inputMode="numeric" onChange={(e) => setExpiry(e.target.value)} />
        </label>
        <p>{t('apiKeys.forUser.confirm')}</p>
        <label>
          {t('apiKeys.forUser.password')} <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label>
          {t('apiKeys.forUser.code')} <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        <button type="submit" disabled={busy}>
          {t('apiKeys.forUser.create')}
        </button>
      </form>
    </section>
  )
}
