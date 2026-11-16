import React from 'react'

import { getEngine } from '@/engine'

import { AuthCaptcha } from './AuthCaptcha'
import { authCaptchaConfig } from './authCaptcha'

/** Server side wrapper: renders the challenge only when Form settings require it on sign-in screens. */
export async function AuthCaptchaField(): Promise<React.ReactElement | null> {
  const config = await authCaptchaConfig((await getEngine()) as never)
  return config ? <AuthCaptcha provider={config.provider} siteKey={config.siteKey} /> : null
}
