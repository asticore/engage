import React from 'react'

import { ComingSoonSignup } from '@/features/site/ComingSoonSignup'
import { getScreenSignup } from '@/features/site/screenContext'

type P = Record<string, unknown>

/** Server half of `coming-soon-signup`: the signup the layout prepared for this request, or nothing. */
export function ComingSoonSignupElement(_props: P): React.ReactElement | null {
  const signup = getScreenSignup()
  if (!signup) return null
  return <ComingSoonSignup action={signup.action} strings={signup.strings} captcha={signup.captcha} />
}

export const COMING_SOON_COMPONENTS: Record<string, React.ComponentType<P>> = {
  'coming-soon-signup': ComingSoonSignupElement as never,
}
