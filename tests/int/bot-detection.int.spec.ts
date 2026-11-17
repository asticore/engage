import { describe, expect, it } from 'vitest'

import { authCaptchaConfig, authCaptchaRefusal } from '@/features/security/authCaptcha'
import { botDecision, isLikelyBot, normaliseBotMode, readBotSignals } from '@/features/security/botSignals'

const engine = (spam: Record<string, unknown> | null) => ({ findGlobal: async () => (spam ? { spam } : null) })
const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null })
const keys = { turnstile: true, turnstileSiteKey: 'site', turnstileSecretKey: 'secret' }

describe('bot signals', () => {
  it('reads the score from the header or the cf object, ignoring junk', () => {
    expect(readBotSignals(h({ 'cf-bot-score': '12' })).score).toBe(12)
    expect(readBotSignals(h({}), { botManagement: { score: 5, verifiedBot: true } })).toEqual({ score: 5, verifiedBot: true })
    expect(readBotSignals(h({ 'cf-bot-score': '0' })).score).toBeNull()
    expect(readBotSignals(h({ 'cf-bot-score': 'x' })).score).toBeNull()
    expect(readBotSignals(null).score).toBeNull()
  })
  it('flags only low scores that are not verified bots', () => {
    expect(isLikelyBot({ score: 10, verifiedBot: false })).toBe(true)
    expect(isLikelyBot({ score: 30, verifiedBot: false })).toBe(false)
    expect(isLikelyBot({ score: 2, verifiedBot: true })).toBe(false)
    expect(isLikelyBot({ score: null, verifiedBot: false })).toBe(false)
  })
  it('maps modes to decisions', () => {
    const bot = { score: 5, verifiedBot: false }
    expect(botDecision('off', bot)).toBe('allow')
    expect(botDecision('challenge', bot)).toBe('challenge')
    expect(botDecision('block', bot)).toBe('block')
    expect(botDecision('block', { score: 80, verifiedBot: false })).toBe('allow')
    expect(normaliseBotMode('nonsense')).toBe('off')
  })
})

describe('bot score and the sign-in challenge', () => {
  const bot = { score: 5, verifiedBot: false }
  const person = { score: 90, verifiedBot: false }
  it('asks for the challenge on a low score even when sign-in protection is off', async () => {
    const on = { ...keys, botDetection: 'challenge' }
    expect(await authCaptchaConfig(engine(on) as never, 'signin', bot)).toMatchObject({ provider: 'turnstile', siteKey: 'site' })
    expect(await authCaptchaConfig(engine(on) as never, 'signin', person)).toBeNull()
    expect(await authCaptchaRefusal(engine(on) as never, new FormData(), undefined, 'signin', bot)).toContain('challenge')
    expect(await authCaptchaRefusal(engine(on) as never, new FormData(), undefined, 'signin', person)).toBeNull()
  })
  it('does nothing while detection is off', async () => {
    expect(await authCaptchaConfig(engine(keys) as never, 'signin', bot)).toBeNull()
  })
  it('refuses a low score outright in block mode', async () => {
    const blockOn = { botDetection: 'block' }
    expect(await authCaptchaRefusal(engine(blockOn) as never, new FormData(), undefined, 'signin', bot)).toContain('challenge')
  })
})

describe('fingerprint and verified bot category rules', () => {
  it('reads JA3, JA4 and the category from headers or the cf object', () => {
    const s = readBotSignals(h({ 'cf-ja3-hash': 'ABC', 'cf-ja4': 'T13d', 'cf-verified-bot-category': 'AI Crawler', 'cf-verified-bot': 'true' }))
    expect(s).toMatchObject({ ja3: 'abc', ja4: 't13d', category: 'AI Crawler', verifiedBot: true })
    expect(readBotSignals(h({}), { botManagement: { ja3Hash: 'xyz' }, verifiedBotCategory: 'Search Engine Crawler' })).toMatchObject({ ja3: 'xyz', category: 'Search Engine Crawler' })
  })
  it('treats a listed fingerprint as a bot whatever the score', () => {
    const rules = { fingerprints: ['abc'] }
    expect(isLikelyBot({ score: 95, verifiedBot: false, ja3: 'abc' }, 30, rules)).toBe(true)
    expect(isLikelyBot({ score: 95, verifiedBot: false, ja4: 'abc' }, 30, rules)).toBe(true)
    expect(isLikelyBot({ score: 95, verifiedBot: false, ja3: 'other' }, 30, rules)).toBe(false)
    expect(botDecision('block', { score: null, verifiedBot: false, ja3: 'abc' }, 30, rules)).toBe('block')
  })
  it('lets every verified bot through unless categories are listed', () => {
    const search = { score: 1, verifiedBot: true, category: 'Search Engine Crawler' }
    const ai = { score: 1, verifiedBot: true, category: 'AI Crawler' }
    expect(isLikelyBot(ai)).toBe(false)
    const rules = { allowedCategories: ['search engine crawler'] }
    expect(isLikelyBot(search, 30, rules)).toBe(false)
    expect(isLikelyBot(ai, 30, rules)).toBe(true)
    expect(isLikelyBot({ score: 1, verifiedBot: true }, 30, rules)).toBe(true)
  })
  it('parses lists', async () => {
    const { parseList } = await import('@/features/security/botSignals')
    expect(parseList('ABC\n def ,\n\n')).toEqual(['abc', 'def'])
  })
})
