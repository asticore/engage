'use client'

import { useState, type CSSProperties, type FormEvent } from 'react'

import { confirmIdentityAction } from '../twoFactorActions.client'

const field: CSSProperties = { display: 'block', width: '100%', maxWidth: 360, padding: '0.5rem', margin: '0.25rem 0 0.75rem' }

/** Password or authenticator code in; a ten minute confirmation out (see stepUp.ts). */
export function ConfirmIdentityPanel() {
  const [proof, setProof] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      setResult(await confirmIdentityAction(proof))
      setProof('')
    } catch {
      setResult({ ok: false, message: 'Something went wrong. Try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <label>
        Password or authenticator code
        <input type="password" autoComplete="current-password" value={proof} onChange={(e) => setProof(e.target.value)} style={field} required />
      </label>
      <button type="submit" disabled={busy || proof.length === 0}>
        {busy ? 'Checking...' : 'Confirm it is me'}
      </button>
      {result ? (
        <p role="status" style={{ color: result.ok ? 'inherit' : '#b00020' }}>
          {result.message}
        </p>
      ) : null}
    </form>
  )
}
