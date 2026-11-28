'use client'
import React, { useState } from 'react'

/** "Was this helpful?" under a FAQ answer. Sends one vote, then thanks the visitor. */
export function FaqVote({ id }: { id: number }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const send = async (helpful: boolean) => {
    setState('sending')
    try {
      const res = await fetch('/api/faq-vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, helpful }) })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }
  if (state === 'done') return <p className="mt-4 text-sm opacity-70" role="status">Thanks for your feedback.</p>
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
      <span>Was this helpful?</span>
      <button type="button" disabled={state === 'sending'} onClick={() => send(true)} className="border border-[var(--color-line)] px-3 py-1">Yes</button>
      <button type="button" disabled={state === 'sending'} onClick={() => send(false)} className="border border-[var(--color-line)] px-3 py-1">No</button>
      {state === 'error' && <span role="alert">Could not save. Try again.</span>}
    </div>
  )
}
