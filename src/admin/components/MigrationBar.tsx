'use client'

import { useEffect, useState } from 'react'

/** Shown to super admins after an update lands: the running code is newer than the database, so run the migration. */
export function MigrationBar() {
  const [pending, setPending] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/admin-engage-migrate', { cache: 'no-store', credentials: 'same-origin' })
      .then((r) => (r.ok ? (r.json() as Promise<{ pending?: boolean }>) : null))
      .then((b) => setPending(Boolean(b?.pending)))
      .catch((): void => undefined)
  }, [])

  if (!pending) return null
  const run = async () => {
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin-engage-migrate', { method: 'POST', credentials: 'same-origin' })
      if (res.ok) window.location.reload()
      else setMessage('The migration did not finish. Nothing was dropped. Try again, or restore the backup taken before the update.')
    } catch {
      setMessage('Could not reach the site. Try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div role="status" data-testid="migration-bar" className="card" style={{ margin: 8 }}>
      <div className="card-body cluster">
        <strong>Finish update: the database needs a quick migration. Existing data is kept.</strong>
        <button type="button" className="btn" disabled={busy} onClick={() => void run()}>{busy ? 'Migrating…' : 'Run migration'}</button>
        {message ? <span role="alert">{message}</span> : null}
      </div>
    </div>
  )
}
