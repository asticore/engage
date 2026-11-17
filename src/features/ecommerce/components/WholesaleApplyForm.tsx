'use client'

import React, { useState } from 'react'

type State = { kind: 'idle' | 'busy' | 'done' | 'error'; text?: string }

export type WholesaleFormText = { company: string; taxId: string; phone: string; message: string; apply: string; applyAgain: string; done: string; error: string }

/** The wholesale application form for a signed-in customer. The page passes the visitor's language as `text`. */
export const WholesaleApplyForm: React.FC<{ resend?: boolean; text: WholesaleFormText }> = ({ resend = false, text }) => {
  const [state, setState] = useState<State>({ kind: 'idle' })
  if (state.kind === 'done') return <p role="status">{text.done}</p>
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        setState({ kind: 'busy' })
        const form = new FormData(e.currentTarget)
        const res = await fetch('/api/wholesale-apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(form)) })
        const data = (await res.json().catch((): null => null)) as { ok?: boolean; error?: string } | null
        if (!res.ok || !data?.ok) return setState({ kind: 'error', text: data?.error ?? text.error })
        setState({ kind: 'done' })
      }}
      style={{ display: 'grid', gap: '0.75rem', maxWidth: '28rem' }}
    >
      <label>{text.company}<br /><input name="company" required maxLength={120} autoComplete="organization" /></label>
      <label>{text.taxId}<br /><input name="taxId" maxLength={40} /></label>
      <label>{text.phone}<br /><input name="phone" maxLength={40} autoComplete="tel" /></label>
      <label>{text.message}<br /><textarea name="message" maxLength={1000} rows={4} /></label>
      <button type="submit" disabled={state.kind === 'busy'}>{resend ? text.applyAgain : text.apply}</button>
      {state.kind === 'error' && <p role="alert">{state.text}</p>}
    </form>
  )
}
