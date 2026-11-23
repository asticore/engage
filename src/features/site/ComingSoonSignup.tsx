'use client'

import React, { useState } from 'react'

import { AuthCaptcha } from '@/features/security/AuthCaptcha'

export type ComingSoonSignupText = {
  label: string
  placeholder: string
  button: string
  sending: string
  thanks: string
  error: string
}

export type ComingSoonCaptcha = { provider: 'turnstile' | 'recaptcha'; siteKey: string; appearance?: 'visible' | 'invisible' }

/**
 * The email signup on the coming soon screen. Posts the address to the built-in
 * "Coming soon" form (see src/features/forms/comingSoon.ts), so each signup is
 * an ordinary form entry. Plain styling from the theme variables, like the rest
 * of the screen. With a captcha on forms the challenge is drawn above the error line
 * and its token is posted under the field name the form route reads.
 */
export function ComingSoonSignup({ action, strings, captcha }: { action: string; strings: ComingSoonSignupText; captcha?: ComingSoonCaptcha }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  // Sent with the post so the form's fill-time check sees a real visit, not an instant bot.
  const [renderedAt] = useState(() => Date.now())

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    // The challenge fills a hidden field; the form route reads it under the same name the form block uses.
    const token = captcha ? String(form.get(captcha.provider === 'turnstile' ? 'cf-turnstile-response' : 'g-recaptcha-response') ?? '') : ''
    setState('sending')
    try {
      const response = await fetch(action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, eg_rendered_at: renderedAt, ...(captcha && token ? { [captcha.provider === 'turnstile' ? 'cf-turnstile-response' : 'g-recaptcha-response']: token } : {}) }),
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
      {captcha && <AuthCaptcha provider={captcha.provider} siteKey={captcha.siteKey} appearance={captcha.appearance} />}
      {state === 'error' && (
        <p role="alert" className="text-sm text-[var(--color-ink)]">
          {strings.error}
        </p>
      )}
    </form>
  )
}
