'use client'

import React, { useState } from 'react'

/** One-click "Block this IP" for audit log rows (Task 19c). Adds the address to the block list; the server refuses your own address. */
export const BlockIpButton: React.FC<{ ip: string }> = ({ ip }) => {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [error, setError] = useState('')
  const run = async () => {
    if (!window.confirm(`Block ${ip} from the whole site?`)) return
    setState('busy')
    setError('')
    const res = await fetch('/api/admin-ip-rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add', kind: 'block', entries: ip, reason: 'Blocked from the audit log' }) }).catch((): null => null)
    const data = (await res?.json().catch((): null => null)) as { error?: string } | null
    if (res?.ok) setState('done')
    else {
      setState('idle')
      setError(data?.error ?? 'Could not block it.')
    }
  }
  return (
    <span>
      {ip}{' '}
      {state === 'done' ? <em>Blocked</em> : <button type="button" disabled={state === 'busy'} onClick={() => void run()}>Block this IP</button>}
      {error && <span role="alert"> {error}</span>}
    </span>
  )
}
