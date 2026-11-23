import { getEngine } from '@/engine'
import { loadStrings, type UiStringKey } from '@/features/uiStrings'

import { COMING_SOON_FORM_KEY, ensureComingSoonForm, comingSoonSignupOpen } from './comingSoon'
import { formsEnabled, getFormSettings } from './settings'

/**
 * What the coming soon screen needs to show its email signup, or null when it
 * should show none. Server only: the layout calls it while the screen is up.
 *
 * None when Forms is off, when the built-in form is a draft, or when the site
 * has a captcha on forms but no site key to draw it with (every signup would
 * fail). With a captcha on, the screen carries the widget config so the signup
 * can draw the challenge. Creates the built-in form on first use.
 */

export const COMING_SOON_SIGNUP_KEYS = {
  label: 'comingSoon.signup.label',
  placeholder: 'comingSoon.signup.placeholder',
  button: 'comingSoon.signup.button',
  sending: 'comingSoon.signup.sending',
  thanks: 'comingSoon.signup.thanks',
  error: 'comingSoon.signup.error',
} as const satisfies Record<string, UiStringKey>

export type ComingSoonSignup = {
  /** Same-site address the form posts to. */
  action: string
  strings: Record<keyof typeof COMING_SOON_SIGNUP_KEYS, string>
  /** The challenge to draw above the button, when the site has a captcha on forms. */
  captcha?: { provider: 'turnstile' | 'recaptcha'; siteKey: string; appearance?: 'visible' | 'invisible' }
}

/** The widget the screen must draw for the saved captcha settings: null when none is on, undefined when it is on but cannot be drawn. */
export function captchaForSignup(settings: {
  turnstile?: boolean
  captchaProvider?: string
  turnstileSiteKey?: string
  recaptchaSiteKey?: string
  captchaAppearance?: string
}): ComingSoonSignup['captcha'] | null | undefined {
  if (!settings.turnstile) return null
  if (settings.captchaProvider === 'recaptcha') return settings.recaptchaSiteKey ? { provider: 'recaptcha', siteKey: settings.recaptchaSiteKey } : undefined
  if (!settings.turnstileSiteKey) return undefined
  return { provider: 'turnstile', siteKey: settings.turnstileSiteKey, appearance: settings.captchaAppearance === 'invisible' ? 'invisible' : 'visible' }
}

export async function comingSoonSignupFor(locale: string | null): Promise<ComingSoonSignup | null> {
  const engine = (await getEngine()) as never
  if (!(await formsEnabled(engine))) return null
  const settings = await getFormSettings(engine)
  const captcha = captchaForSignup(settings)
  if (captcha === undefined) return null

  const form = await ensureComingSoonForm(engine)
  if (!comingSoonSignupOpen(form)) return null

  const dict = await loadStrings(locale)
  const strings = Object.fromEntries(
    Object.entries(COMING_SOON_SIGNUP_KEYS).map(([name, key]) => [name, dict[key]]),
  ) as ComingSoonSignup['strings']
  return { action: `/api/forms/${COMING_SOON_FORM_KEY}/submit`, strings, ...(captcha ? { captcha } : {}) }
}
