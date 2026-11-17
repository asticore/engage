'use client'

import React, { useState } from 'react'

export type ComingSoonSignupText = {
  label: string
  placeholder: string
  button: string
  sending: string
  thanks: string
  error: string
}

/**
 * The email signup on the coming soon screen. Posts the address to the built-in
 * "Coming soon" form (see src/features/forms/comingSoon.ts), so each signup is
 * an ordinary form entry. Plain styling from the theme variables, like the rest
 * of the screen.
 */
export function ComingSoonSignup({ action, strings }: { action: string; strings: ComingSoonSignupText }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  // Sent with the post so the form's fill-time check sees a real visit, not an instant bot.
  const [renderedAt] = useState(() => Date.now())

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim()
    setState('sending')
    try {
      const response = await fetch(action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, eg_rendered_at: renderedAt }),
      })
      const data = (await response.json().catch((): null => null)) as { ok?: boolean } | null
      setState(response.ok && data?.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <p role="status" className="mt-8 text-[var(--color-ink)]">
        {strings.thanks}
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex w-full max-w-md flex-col items-stretch gap-2 text-left">
      <label htmlFor="coming-soon-email" className="text-sm text-[var(--color-ink)] opacity-80">
        {strings.label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="coming-soon-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={strings.placeholder}
          className="min-w-0 flex-1 rounded border border-[var(--color-ink)] bg-transparent px-3 py-2 text-[var(--color-ink)]"
        />
        <button
          type="submit"
          disabled={state === 'sending'}
          className="rounded bg-[var(--color-ink)] px-4 py-2 text-[var(--color-paper,#fff)] disabled:opacity-60"
        >
          {state === 'sending' ? strings.sending : strings.button}
        </button>
      </div>
      {state === 'error' && (
        <p role="alert" className="text-sm text-[var(--color-ink)]">
          {strings.error}
        </p>
      )}
    </form>
  )
}
