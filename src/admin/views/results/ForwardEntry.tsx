'use client'

import React, { useState } from 'react'

/**
 * "Forward" on an entry: email this one entry to an address typed here, with a
 * note. Files go as expiring links. The server records who forwarded it and when.
 */
export function ForwardEntry({ entryId }: { entryId: number | string }) {
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  if (!open) {
    return (
      <button type="button" className="et-button" onClick={() => setOpen(true)}>
        Forward
      </button>
    )
  }

  const send = async (): Promise<void> => {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch('/api/admin-form-submission-forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entryId, to, cc, bcc, note }),
      })
      const data = (await response.json().catch((): Record<string, never> => ({}))) as { ok?: boolean; sent?: number; error?: string }
      if (response.ok && data.ok) setMessage({ ok: true, text: `Sent to ${data.sent} address${data.sent === 1 ? '' : 'es'}.` })
      else setMessage({ ok: false, text: data.error || 'Could not forward this entry.' })
    } catch {
      setMessage({ ok: false, text: 'Could not reach the server.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div role="group" aria-label={`Forward entry ${entryId}`} style={{ display: 'grid', gap: 4, minWidth: 220 }}>
      <input type="text" aria-label="Send to" placeholder="Send to (email addresses)" value={to} onChange={(event) => setTo(event.target.value)} />
      <input type="text" aria-label="Cc" placeholder="Cc (optional, visible)" value={cc} onChange={(event) => setCc(event.target.value)} />
      <input type="text" aria-label="Bcc" placeholder="Bcc (optional, hidden)" value={bcc} onChange={(event) => setBcc(event.target.value)} />
      <textarea rows={2} aria-label="Note" placeholder="Note (optional)" value={note} onChange={(event) => setNote(event.target.value)} />
      <div>
        <button type="button" className="et-button" disabled={busy || !to.trim()} onClick={() => void send()}>
          {busy ? 'Sending...' : 'Send'}
        </button>{' '}
        <button type="button" className="et-button" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      {message ? <p role="status" style={{ color: message.ok ? 'inherit' : 'crimson', margin: 0 }}>{message.text}</p> : null}
    </div>
  )
}
