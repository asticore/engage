// @vitest-environment node
// Coming soon signup with a captcha on forms: the screen draws the challenge instead of switching the signup off.
import { describe, expect, it } from 'vitest'

import { captchaForSignup } from '@/features/forms/comingSoonSignup'

describe('coming soon signup captcha', () => {
  it('has no widget when the site has no captcha', () => {
    expect(captchaForSignup({ turnstile: false, turnstileSiteKey: 'k' })).toBeNull()
    expect(captchaForSignup({})).toBeNull()
  })
  it('draws Turnstile with the saved site key and appearance', () => {
    expect(captchaForSignup({ turnstile: true, captchaProvider: 'turnstile', turnstileSiteKey: 'site', captchaAppearance: 'invisible' })).toEqual({ provider: 'turnstile', siteKey: 'site', appearance: 'invisible' })
    expect(captchaForSignup({ turnstile: true, turnstileSiteKey: 'site' })).toEqual({ provider: 'turnstile', siteKey: 'site', appearance: 'visible' })
  })
  it('draws reCAPTCHA with its own key', () => {
    expect(captchaForSignup({ turnstile: true, captchaProvider: 'recaptcha', recaptchaSiteKey: 'rk', turnstileSiteKey: 'ignored' })).toEqual({ provider: 'recaptcha', siteKey: 'rk' })
  })
  it('switches the signup off only when the captcha cannot be drawn (no site key)', () => {
    expect(captchaForSignup({ turnstile: true, captchaProvider: 'turnstile', turnstileSiteKey: '' })).toBeUndefined()
    expect(captchaForSignup({ turnstile: true, captchaProvider: 'recaptcha', recaptchaSiteKey: '' })).toBeUndefined()
  })
})
