import React from 'react'

import { ComingSoonSignup, type ComingSoonCaptcha, type ComingSoonSignupText } from './ComingSoonSignup'
import { LaunchCountdown } from './LaunchCountdown'

/**
 * The screen visitors see while maintenance or coming soon mode is on. Plain markup, styled by the theme variables the
 * root layout already sets, so it follows light and dark mode with no CSS of its own. With a launch date it shows a countdown.
 */
export function MaintenanceScreen({
  headline,
  message,
  launchAt,
  signup,
}: {
  headline: string
  message: string
  launchAt?: string | null
  /** The email signup, for coming soon mode only. Null hides it. */
  signup?: { action: string; strings: ComingSoonSignupText; captcha?: ComingSoonCaptcha } | null
}) {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-[var(--max-width)] flex-col items-center justify-center px-6 py-24 text-center" aria-labelledby="maintenance-heading">
      <h1 id="maintenance-heading" className="text-4xl text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-display)' }}>
        {headline}
      </h1>
      {message && <p className="mx-auto mt-4 max-w-xl whitespace-pre-line text-[var(--color-ink)] opacity-80">{message}</p>}
      {launchAt ? <LaunchCountdown launchAt={launchAt} /> : null}
      {signup ? <ComingSoonSignup action={signup.action} strings={signup.strings} captcha={signup.captcha} /> : null}
    </section>
  )
}
