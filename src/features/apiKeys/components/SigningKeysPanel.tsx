'use client'

import React, { useCallback, useEffect, useState } from 'react'

type KeyRow = { kid: string; createdAt: string; retiredAt: string | null; status: 'active' | 'retiring' | 'expired' }
type Payload = { enabled: boolean; jwksPath: string; keys: KeyRow[] }

/**
 * Admin view of the keys that sign API access tokens: the public key set address, each key's state and a
 * Rotate now button. Key material never reaches the browser. Shown under API keys.
 */
export function SigningKeysPanel(): React.ReactElement | null {
  const [data, setData] = useState<Payload | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    const response = await fetch('/api/admin-signing-keys', { credentials: 'include' }).catch((): null => null)
    if (response?.ok) setData((await response.json()) as Payload)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!data) return null

  const rotate = async (): Promise<void> => {
    setBusy(true)
    setNote('')
    const response = await fetch('/api/admin-signing-keys', { method: 'POST', credentials: 'include' }).catch((): null => null)
    setNote(response?.ok ? 'A new signing key is now in use. The old one stays published until its tokens have expired.' : 'Could not rotate the key. Try again.')
    setBusy(false)
    await load()
  }

  return (
    <section style={{ display: 'grid', gap: '0.5rem' }} data-testid="signing-keys-panel">
      <h2>Access tokens and signing keys</h2>
      <p>
        An API key can be traded for a short-lived signed token at <code>POST /api/auth/token</code> (15 minutes by default, one hour at most). Other
        systems check those tokens against the public keys at <code>{data.jwksPath}</code>. Keys rotate by themselves every 30 days.
      </p>
      {!data.enabled ? (
        <small>Switch on API keys in Settings &gt; Security to use access tokens.</small>
      ) : (
        <>
          {data.keys.length === 0 ? <small>No signing key yet. One is made the first time a token is issued.</small> : null}
          <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
            {data.keys.map((key) => (
              <li key={key.kid}>
                <code>{key.kid}</code> - {key.status}, made {key.createdAt.slice(0, 10)}
              </li>
            ))}
          </ul>
          <div>
            <button type="button" onClick={rotate} disabled={busy}>
              Rotate now
            </button>
          </div>
          {note ? <small role="status">{note}</small> : null}
        </>
      )}
    </section>
  )
}
