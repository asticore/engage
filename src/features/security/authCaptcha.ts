import { RECAPTCHA_FIELD, TURNSTILE_FIELD, checkCaptcha } from '@/features/forms/spam'
import { getFormSettings, type EngineLike } from '@/features/forms/settings'

/**
 * The spam challenge (Turnstile or reCAPTCHA, keys in Form settings) on member sign-in, create account and forgot
 * password. Off unless Form settings, Spam protection has both the challenge and "protect sign-in" switched on.
 * Fails open when the keys are missing or the provider cannot be reached (a log line, never a locked-out site).
 */

export type PublicCaptcha = { provider: 'turnstile' | 'recaptcha'; siteKey: string }

/** What the browser needs to draw the widget, or null when the challenge is not required here. */
export type CaptchaPlace = 'signin' | 'comments' | 'chatbot'

export async function authCaptchaConfig(engine: EngineLike, place: CaptchaPlace = 'signin'): Promise<PublicCaptcha | null> {
  try {
    const s = await getFormSettings(engine)
    if (!s.turnstile || (place === 'signin' && !s.protectSignIn)) return null
    const siteKey = s.captchaProvider === 'recaptcha' ? s.recaptchaSiteKey : s.turnstileSiteKey
    return siteKey ? { provider: s.captchaProvider, siteKey } : null
  } catch {
    return null
  }
}

/** A message to show when the challenge failed, else null. */
export async function authCaptchaRefusal(engine: EngineLike, form: FormData, ip?: string, place: CaptchaPlace = 'signin'): Promise<string | null> {
  try {
    const s = await getFormSettings(engine)
    if (!s.turnstile || (place === 'signin' && !s.protectSignIn)) return null
    const verdict = await checkCaptcha({ turnstile: form.get(TURNSTILE_FIELD), recaptcha: form.get(RECAPTCHA_FIELD) }, s, ip)
    if (!verdict.spam) return null
    if (verdict.reason === 'turnstile-unavailable') return null
    return 'Please complete the challenge and try again.'
  } catch {
    return null
  }
}
