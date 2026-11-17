import { getEngine } from '@/engine'
import { loadStrings, type UiStringKey } from '@/features/uiStrings'

import { COMING_SOON_FORM_KEY, ensureComingSoonForm, comingSoonSignupOpen } from './comingSoon'
import { formsEnabled, getFormSettings } from './settings'

/**
 * What the coming soon screen needs to show its email signup, or null when it
 * should show none. Server only: the layout calls it while the screen is up.
 *
 * None when Forms is off, when the built-in form is a draft, or when the site
 * has a captcha on forms (the screen has no challenge widget, so every signup
 * would fail). Creates the built-in form on first use.
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
}

export async function comingSoonSignupFor(locale: string | null): Promise<ComingSoonSignup | null> {
  const engine = (await getEngine()) as never
  if (!(await formsEnabled(engine))) return null
  const settings = await getFormSettings(engine)
  if (settings.turnstile) return null

  const form = await ensureComingSoonForm(engine)
  if (!comingSoonSignupOpen(form)) return null

  const dict = await loadStrings(locale)
  const strings = Object.fromEntries(
    Object.entries(COMING_SOON_SIGNUP_KEYS).map(([name, key]) => [name, dict[key]]),
  ) as ComingSoonSignup['strings']
  return { action: `/api/forms/${COMING_SOON_FORM_KEY}/submit`, strings }
}
