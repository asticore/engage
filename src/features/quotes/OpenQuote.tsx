'use client'

import { useState } from 'react'

/** "Open quote" on the account page: asks for a fresh private link, then goes to it. */
export function OpenQuote({ id }: { id: number }): React.ReactElement {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const open = async (): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/account-quote-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      const body = (await res.json().catch((): { error?: string; url?: string } => ({}))) as { error?: string; url?: string }
      if (res.ok && body.url) window.location.assign(body.url)
      else setError(body.error ?? 'That did not work.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button type="button" className="btn" disabled={busy} onClick={() => void open()}>Open quote</button>
      {error ? <p role="alert" className="form-error">{error}</p> : null}
    </>
  )
}
