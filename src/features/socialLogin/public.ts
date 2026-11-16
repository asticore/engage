import type { Engine } from '@/engine'

import { isUsable } from './providers'
import { readSocialConfig, usableProviders, type PublicProvider } from './settings'

/** Providers to show on a public screen: enabled and configured, nothing else. Never throws. */
export async function publicProviders(engine: Engine, area: 'account' | 'admin' | 'members' = 'account'): Promise<PublicProvider[]> {
  try {
    return usableProviders(await readSocialConfig(engine), area)
  } catch {
    return []
  }
}

/** The register screen additionally needs sign-up via social to be allowed. */
export async function registerProviders(engine: Engine): Promise<PublicProvider[]> {
  const config = await readSocialConfig(engine)
  return config.allowSignupViaSocial ? usableProviders(config, 'account') : []
}

/** Whether to show Google One Tap on the member sign-in page: switched on, Google complete, and not blocked for members. */
export async function oneTapAvailable(engine: Engine): Promise<boolean> {
  try {
    const config = await readSocialConfig(engine)
    return config.googleOneTap && isUsable('google', config.providers.google) && !(config.blocked?.account ?? []).includes('google')
  } catch {
    return false
  }
}
