'use client'

import React, { useState } from 'react'

type State = { kind: 'idle' | 'busy' | 'done' | 'error'; text?: string }

/** The wholesale application form for a signed-in customer. English only. */
export const WholesaleApplyForm: React.FC<{ resend?: boolean }> = ({ resend = false }) => {
  const [state, setState] = useState<State>({ kind: 'idle' })
  if (state.kind === 'done') return <p role="status">Thanks. Your application is with us. You will be able to see wholesale prices and products once it is approved.</p>
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        setState({ kind: 'busy' })
        const form = new FormData(e.currentTarget)
        const res = await fetch('/api/wholesale-apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(form)) })
        const data = (await res.json().catch((): null => null)) as { ok?: boolean; error?: string } | null
        if (!res.ok || !data?.ok) return setState({ kind: 'error', text: data?.error ?? 'That did not work. Please try again.' })
        setState({ kind: 'done' })
      }}
      style={{ display: 'grid', gap: '0.75rem', maxWidth: '28rem' }}
    >
      <label>Company name<br /><input name="company" required maxLength={120} autoComplete="organization" /></label>
      <label>Business or tax number (optional)<br /><input name="taxId" maxLength={40} /></label>
      <label>Phone (optional)<br /><input name="phone" maxLength={40} autoComplete="tel" /></label>
      <label>Anything we should know (optional)<br /><textarea name="message" maxLength={1000} rows={4} /></label>
      <button type="submit" disabled={state.kind === 'busy'}>{resend ? 'Apply again' : 'Apply for a wholesale account'}</button>
      {state.kind === 'error' && <p role="alert">{state.text}</p>}
    </form>
  )
}
