import { describe, expect, it } from 'vitest'

import { rememberVersions, versionHeaders } from '@/features/integrations/admin/connectionVersions'
import { checkGoogleKeyShape, checkPageSpeedKey, checkRecaptchaKeys } from '@/features/integrations/remoteChecks'
import { currentVersions, expectedVersions, isStale } from '@/features/integrations/staleTab'
import { VERSIONS_HEADER } from '@/features/integrations/versionHeaders'

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })

describe('Google Maps key check (shape only)', () => {
  it('says so when no key is saved', () => {
    expect(checkGoogleKeyShape('', 'Google Maps key').ok).toBe(false)
  })

  it('accepts the Google key shape and refuses anything else', () => {
    const good = `AIza${'a'.repeat(35)}`
    expect(checkGoogleKeyShape(good, 'Google Maps key').ok).toBe(true)
    expect(checkGoogleKeyShape('AIza-short', 'Google Maps key').ok).toBe(false)
    expect(checkGoogleKeyShape(`sk-${'a'.repeat(36)}`, 'Google Maps key').ok).toBe(false)
  })
})

describe('PageSpeed key check', () => {
  it('uses no call when no key is saved', async () => {
    const result = await checkPageSpeedKey('', async () => {
      throw new Error('should not be called')
    })
    expect(result.ok).toBe(false)
  })

  it('reads a "missing url" answer as a good key, and never runs a test', async () => {
    const calls: string[] = []
    const result = await checkPageSpeedKey('key-123', async (url) => {
      calls.push(url)
      return json(400, { error: { message: 'Missing required parameter: url' } })
    })
    expect(result.ok).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0]).not.toContain('url=')
  })

  it('refuses a key Google does not accept', async () => {
    const result = await checkPageSpeedKey('bad', async () => json(400, { error: { message: 'API key not valid. Please pass a valid API key.' } }))
    expect(result.ok).toBe(false)
    expect(result.message).toContain('API key not valid')
  })
})

describe('reCAPTCHA key checks', () => {
  it('refuses a secret Google does not recognise', async () => {
    const result = await checkRecaptchaKeys({ siteKey: `6L${'x'.repeat(38)}`, secretKey: `6L${'y'.repeat(38)}` }, async () =>
      json(200, { success: false, 'error-codes': ['invalid-input-secret'] }),
    )
    expect(result.secretKey.ok).toBe(false)
    expect(result.siteKey.ok).toBe(true)
  })

  it('accepts a secret when Google only rejects the made-up token', async () => {
    const result = await checkRecaptchaKeys({ siteKey: `6L${'x'.repeat(38)}`, secretKey: `6L${'y'.repeat(38)}` }, async () =>
      json(200, { success: false, 'error-codes': ['invalid-input-response'] }),
    )
    expect(result.secretKey.ok).toBe(true)
  })

  it('checks the site key shape without calling Google, and says when nothing is saved', async () => {
    const result = await checkRecaptchaKeys({ siteKey: 'not-a-key', secretKey: '' }, async () => {
      throw new Error('should not be called')
    })
    expect(result.siteKey.ok).toBe(false)
    expect(result.secretKey.ok).toBe(false)
  })
})

describe('stale-tab versions', () => {
  const engineWith = (docs: Record<string, { updatedAt?: string }>) => ({
    findGlobal: async ({ slug }: { slug: string }) => docs[slug] ?? null,
  }) as never

  it('reads only a JSON object of string versions from the header', () => {
    const request = (value: string | null) =>
      new Request('https://example.com/api', { headers: value === null ? {} : { [VERSIONS_HEADER]: value } })
    expect(expectedVersions(request(null))).toEqual({})
    expect(expectedVersions(request('not json'))).toEqual({})
    expect(expectedVersions(request('[1,2]'))).toEqual({})
    expect(expectedVersions(request('{"integrations":"2026-01-01","google-connection":5,"x":""}'))).toEqual({ integrations: '2026-01-01' })
  })

  it('is stale only when the stored global moved on since the page loaded it', async () => {
    const engine = engineWith({ integrations: { updatedAt: '2026-11-02T10:00:00.000Z' } })
    expect(await isStale(engine, 'integrations', { integrations: '2026-11-02T10:00:00.000Z' })).toBe(false)
    expect(await isStale(engine, 'integrations', { integrations: '2026-11-01T09:00:00.000Z' })).toBe(true)
    // No expectation for this global, or no stored version: never a conflict.
    expect(await isStale(engine, 'integrations', {})).toBe(false)
    expect(await isStale(engineWith({}), 'integrations', { integrations: 'anything' })).toBe(false)
  })

  it('returns the current version of each screen global', async () => {
    const engine = engineWith({ 'tracking-connections': { updatedAt: 'a' }, integrations: { updatedAt: 'c' } })
    expect(await currentVersions(engine)).toEqual({ 'tracking-connections': 'a', 'google-connection': null, integrations: 'c' })
  })
})

describe('screen version store', () => {
  it('sends what the page holds and keeps the newer versions an answer carries', () => {
    const ref = { current: { 'tracking-connections': 'a', 'google-connection': null, integrations: 'c' } as Record<string, string | null> }
    expect(JSON.parse(versionHeaders(ref as never)[VERSIONS_HEADER])).toEqual({ 'tracking-connections': 'a', integrations: 'c' })
    rememberVersions(ref as never, { ok: true, versions: { 'tracking-connections': 'b', 'google-connection': 'd', integrations: 'c' } })
    expect(ref.current).toEqual({ 'tracking-connections': 'b', 'google-connection': 'd', integrations: 'c' })
    rememberVersions(ref as never, { ok: false, reason: 'conflict' })
    expect(ref.current['tracking-connections']).toBe('b')
  })
})
