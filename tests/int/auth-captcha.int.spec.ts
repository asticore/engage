import { afterEach, describe, expect, it, vi } from 'vitest'

import { authCaptchaConfig, authCaptchaRefusal } from '@/features/security/authCaptcha'

const engine = (spam: Record<string, unknown> | null) => ({
  findGlobal: async () => (spam ? { spam } : null),
})

afterEach(() => vi.restoreAllMocks())

describe('sign-in challenge', () => {
  it('is off by default', async () => {
    expect(await authCaptchaConfig(engine(null) as never)).toBeNull()
    expect(await authCaptchaRefusal(engine({ turnstile: true }) as never, new FormData())).toBeNull()
  })
  it('needs the challenge, the switch and a site key', async () => {
    const on = { turnstile: true, protectSignIn: true, turnstileSiteKey: 'site', turnstileSecretKey: 'secret' }
    expect(await authCaptchaConfig(engine(on) as never)).toMatchObject({ provider: 'turnstile', siteKey: 'site' })
    expect(await authCaptchaConfig(engine({ ...on, turnstileSiteKey: '' }) as never)).toBeNull()
    expect(await authCaptchaConfig(engine({ ...on, captchaProvider: 'recaptcha', recaptchaSiteKey: 'rk', recaptchaSecretKey: 'rs' }) as never)).toMatchObject({ provider: 'recaptcha', siteKey: 'rk' })
  })
  it('refuses a missing token and accepts a good one', async () => {
    const on = { turnstile: true, protectSignIn: true, turnstileSiteKey: 'site', turnstileSecretKey: 'secret' }
    expect(await authCaptchaRefusal(engine(on) as never, new FormData())).toContain('challenge')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: true })))
    const form = new FormData()
    form.set('cf-turnstile-response', 'tok')
    expect(await authCaptchaRefusal(engine(on) as never, form)).toBeNull()
  })
  it('lets people in when the keys are missing', async () => {
    const noKeys = { turnstile: true, protectSignIn: true }
    expect(await authCaptchaRefusal(engine(noKeys) as never, new FormData())).toBeNull()
  })
})
