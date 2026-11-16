'use client'

import React, { useState } from 'react'

type State = { kind: 'idle' | 'busy' | 'done' | 'error'; text?: string; dashboard?: string; active?: boolean }

/** The public affiliate sign-up form. English only. */
export const JoinForm: React.FC = () => {
  const [state, setState] = useState<State>({ kind: 'idle' })
  if (state.kind === 'done') {
    return (
      <div role="status">
        <p>{state.active ? 'You are in. Your link is ready.' : 'Thanks. Your application is with the site owner for approval.'}</p>
        {state.dashboard && (
          <p>
            Keep this private link. It is how you see your link, visits and earnings: <a href={state.dashboard}>Open your dashboard</a>
          </p>
        )}
      </div>
    )
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        setState({ kind: 'busy' })
        const form = new FormData(e.currentTarget)
        const res = await fetch('/api/affiliate-join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(form)) })
        const data = (await res.json().catch((): null => null)) as { ok?: boolean; error?: string; status?: string; dashboard?: string } | null
        if (!res.ok || !data?.ok) return setState({ kind: 'error', text: data?.error ?? 'That did not work. Please try again.' })
        setState({ kind: 'done', dashboard: data.dashboard, active: data.status === 'active' })
      }}
      style={{ display: 'grid', gap: '0.75rem', maxWidth: '28rem' }}
    >
      <label>
        Your name
        <br />
        <input name="name" required maxLength={80} autoComplete="name" />
      </label>
      <label>
        Email
        <br />
        <input name="email" type="email" required maxLength={200} autoComplete="email" />
      </label>
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}>
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <button type="submit" disabled={state.kind === 'busy'}>
        Join the program
      </button>
      {state.kind === 'error' && <p role="alert">{state.text}</p>}
    </form>
  )
}
