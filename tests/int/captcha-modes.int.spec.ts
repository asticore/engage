import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { authCaptchaConfig, authCaptchaRefusal, captchaFormFrom, noteCaptchaFailure } from '@/features/security/authCaptcha'
import { CAPTCHA_PLACES, effectiveMode, modeFieldOf, readPlaceModes } from '@/features/security/captchaPlaces'
import { resetRateLimiter } from '@/features/security/rateLimit'

const keys = { turnstileSiteKey: 'site', turnstileSecretKey: 'secret' }
const engine = (spam: Record<string, unknown> | null) => ({ findGlobal: async () => (spam ? { spam } : null) })
const ok = () => vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: true })))

beforeEach(() => resetRateLimiter())
afterEach(() => vi.restoreAllMocks())

describe('place modes', () => {
  it('reads every place with default as the fallback', () => {
    const modes = readPlaceModes({ modeSignIn: 'always', modeRsvp: 'failures', modeReviews: 'bogus' })
    expect(modes.signIn).toBe('always')
    expect(modes.rsvp).toBe('failures')
    expect(modes.reviews).toBe('default')
    expect(Object.keys(modes)).toHaveLength(CAPTCHA_PLACES.length)
  })
  it('keeps what the old switches did', () => {
    expect(effectiveMode('signIn', 'default', { turnstile: false, protectSignIn: true })).toBe('always')
    expect(effectiveMode('comments', 'default', { turnstile: true, protectSignIn: false })).toBe('always')
    expect(effectiveMode('rsvp', 'default', { turnstile: true, protectSignIn: true })).toBe('off')
    expect(effectiveMode('rsvp', 'off', { turnstile: true, protectSignIn: true })).toBe('off')
  })
  it('names the settings fields', () => {
    expect(modeFieldOf('backInStock')).toBe('modeBackInStock')
  })
})

describe('always and off', () => {
  it('asks only where the mode says, once keys exist', async () => {
    const spam = { ...keys, modeRsvp: 'always' }
    expect(await authCaptchaConfig(engine(spam) as never, 'rsvp')).toMatchObject({ provider: 'turnstile', siteKey: 'site' })
    expect(await authCaptchaConfig(engine(spam) as never, 'reviews')).toBeNull()
    expect(await authCaptchaConfig(engine({ modeRsvp: 'always' }) as never, 'rsvp')).toBeNull()
  })
  it('refuses a missing token and accepts a good one', async () => {
    const e = engine({ ...keys, modeOfflineOrder: 'always' })
    expect(await authCaptchaRefusal(e as never, new FormData(), '1.1.1.1', 'offlineOrder')).toContain('challenge')
    ok()
    expect(await authCaptchaRefusal(e as never, captchaFormFrom({ 'cf-turnstile-response': 't' }), '1.1.1.1', 'offlineOrder')).toBeNull()
  })
  it('reads tokens from headers too', () => {
    const headers = new Headers({ 'x-cf-turnstile-response': 'abc' })
    expect(captchaFormFrom(null, headers).get('cf-turnstile-response')).toBe('abc')
  })
})

describe('only after repeated failures', () => {
  const spam = { ...keys, modeSignIn: 'failures', failureThreshold: 2 }
  it('stays quiet until the address has failed enough', async () => {
    const e = engine(spam) as never
    expect(await authCaptchaConfig(e, 'signIn', undefined, '9.9.9.9')).toBeNull()
    await noteCaptchaFailure(e, 'signIn', '9.9.9.9')
    expect(await authCaptchaConfig(e, 'signIn', undefined, '9.9.9.9')).toBeNull()
    await noteCaptchaFailure(e, 'signIn', '9.9.9.9')
    expect(await authCaptchaConfig(e, 'signIn', undefined, '9.9.9.9')).not.toBeNull()
    expect(await authCaptchaConfig(e, 'signIn', undefined, '8.8.8.8')).toBeNull()
  })
  it('does not count when the place is in another mode', async () => {
    const e = engine({ ...keys, modeSignIn: 'always', failureThreshold: 1 }) as never
    await noteCaptchaFailure(e, 'reviews', '7.7.7.7')
    expect(await authCaptchaConfig(engine({ ...keys, modeReviews: 'failures', failureThreshold: 1 }) as never, 'reviews', undefined, '7.7.7.7')).toBeNull()
  })
  it('counts tries on places without a failed step', async () => {
    const e = engine({ ...keys, modeBackInStock: 'failures', failureThreshold: 2 }) as never
    for (let i = 0; i < 2; i++) expect(await authCaptchaRefusal(e, new FormData(), '5.5.5.5', 'backInStock')).toBeNull()
    expect(await authCaptchaRefusal(e, new FormData(), '5.5.5.5', 'backInStock')).toContain('challenge')
  })
})

describe('bot score on every place', () => {
  const low = { score: 5, verifiedBot: false }
  it('asks for the challenge on a place that is off', async () => {
    const e = engine({ ...keys, botDetection: 'challenge' }) as never
    expect(await authCaptchaConfig(e, 'backInStock', low)).not.toBeNull()
    expect(await authCaptchaConfig(e, 'backInStock', { score: 80, verifiedBot: false })).toBeNull()
    expect(await authCaptchaConfig(e, 'backInStock', { score: 5, verifiedBot: true })).toBeNull()
  })
  it('refuses outright in block mode', async () => {
    const e = engine({ ...keys, botDetection: 'block' }) as never
    expect(await authCaptchaRefusal(e, new FormData(), '1.1.1.1', 'offlineOrder', low)).toContain('challenge')
  })
})

describe('text question fallback', () => {
  it('accepts the right answer once signed, refuses wrong, expired or forged ones', async () => {
    const { makeFallback, checkFallback } = await import('@/features/security/captchaFallback')
    const now = 1_000_000
    const q = await makeFallback(now, 'secret', () => 0.5)
    expect(q?.question).toMatch(/What is \d plus \d/)
    const sum = (q!.question.match(/\d+/g) ?? []).slice(0, 2).reduce((a, b) => a + Number(b), 0)
    expect(await checkFallback(q!.token, String(sum), now + 1000, 'secret')).toBe(true)
    expect(await checkFallback(q!.token, String(sum + 1), now + 1000, 'secret')).toBe(false)
    expect(await checkFallback(q!.token, String(sum), now + 16 * 60_000, 'secret')).toBe(false)
    expect(await checkFallback(q!.token, String(sum), now + 1000, 'other')).toBe(false)
    expect(await makeFallback(now, '')).toBeNull()
  })
  it('lets a typed answer through the place check', async () => {
    const { makeFallback } = await import('@/features/security/captchaFallback')
    vi.stubEnv('ENGAGE_SECRET', 'secret')
    const q = await makeFallback()
    const sum = (q!.question.match(/\d+/g) ?? []).slice(0, 2).reduce((a, b) => a + Number(b), 0)
    const e = engine({ ...keys, modeAdminSignIn: 'always' }) as never
    expect(await authCaptchaRefusal(e, captchaFormFrom({ 'captcha-answer': String(sum), 'captcha-token': q!.token }), '1.1.1.1', 'adminSignIn')).toBeNull()
    expect(await authCaptchaRefusal(e, captchaFormFrom({ 'captcha-answer': '99', 'captcha-token': q!.token }), '1.1.1.1', 'adminSignIn')).toContain('challenge')
    vi.unstubAllEnvs()
  })
})

describe('flagged visitors summary', () => {
  it('counts by outcome and place', async () => {
    const { summariseBotFlags } = await import('@/features/security/authStats')
    const s = summariseBotFlags([{ detail: 'signIn: asked' }, { detail: 'signIn: refused' }, { detail: 'rsvp: asked' }])
    expect(s).toMatchObject({ total: 3, asked: 2, refused: 1 })
    expect(s.places[0]).toEqual({ place: 'signIn', count: 2 })
  })
})

describe('per-form bot detection', () => {
  it('overrides the site mode only when the form says so', async () => {
    const { resolveForForm, DEFAULT_FORM_SETTINGS } = await import('@/features/forms/settings')
    const site = { ...DEFAULT_FORM_SETTINGS, botDetection: 'challenge' as const }
    expect(resolveForForm({ spam: { botDetection: 'inherit' } } as never, site).botDetection).toBe('challenge')
    expect(resolveForForm({ spam: { botDetection: 'block' } } as never, site).botDetection).toBe('block')
    expect(resolveForForm({ spam: { botDetection: 'off' } } as never, site).botDetection).toBe('off')
    expect(resolveForForm({} as never, site).botDetection).toBe('challenge')
  })
})
