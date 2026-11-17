import { cache } from 'react'

import type { ComingSoonSignup } from '@/features/forms/comingSoonSignup'
import { fillCountdownTargets } from '@/features/site/screenCountdown'

/**
 * What the maintenance and coming soon screen templates need from the site: the launch date (for a Countdown element
 * with no date of its own) and the email signup. One store per request (React cache), set by the layout just before
 * the screen draws, so two visitors never share it.
 */
const store = cache(() => ({ launchAt: null as string | null, signup: null as ComingSoonSignup | null }))

export const setScreenContext = (value: { launchAt: string | null; signup: ComingSoonSignup | null }): void => {
  const current = store()
  current.launchAt = value.launchAt
  current.signup = value.signup
}

export const getScreenSignup = (): ComingSoonSignup | null => store().signup

/** Block transform for the screen templates: a Countdown with a blank date counts down to the launch date. */
export const withLaunchDate = (launchAt: string | null) => (blocks: unknown[]): unknown[] => fillCountdownTargets(blocks, launchAt)
