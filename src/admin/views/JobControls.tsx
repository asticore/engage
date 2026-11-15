'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = { job: string; enabled: boolean; canDisable: boolean }

/** Run now and Enable/Disable for one scheduled job. Talks to /api/admin-cron-job, then refreshes the screen. */
export function JobControls({ job, enabled, canDisable }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const send = async (action: 'run' | 'enable' | 'disable') => {
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin-cron-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job, action }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) setMessage(body.error ?? 'That did not work.')
      else router.refresh()
    } catch {
      setMessage('That did not work.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cluster">
      <button type="button" className="btn" disabled={busy} onClick={() => send('run')}>
        Run now
      </button>
      {canDisable ? (
        <button type="button" className="btn" disabled={busy} onClick={() => send(enabled ? 'disable' : 'enable')}>
          {enabled ? 'Turn off' : 'Turn on'}
        </button>
      ) : null}
      {message ? <span className="sh-error" role="alert">{message}</span> : null}
    </div>
  )
}
