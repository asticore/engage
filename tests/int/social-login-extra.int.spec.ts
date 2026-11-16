// @vitest-environment node
// Task 23d: X, LinkedIn, TikTok, Slack, the free-form OpenID Connect provider and Google One Tap.
// Fake providers and a fake fetch only: nothing touches a network and no real credentials are used.
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { SocialButtons } from '@/features/socialLogin/components/SocialButtons'
import { clearDiscoveryCache, isSafeHttpsUrl, resolveEndpoints } from '@/features/socialLogin/endpoints'
import { applyExtraRows, configFromRow, type ExtraRow } from '@/features/socialLogin/extraStore'
import { validateExtraInput } from '@/features/socialLogin/extraValidate'
import { buildAuthorizeUrl, exchangeForIdentity, FlowError, identityFromClaims } from '@/features/socialLogin/flow'
import { handleOneTapSignIn, handleOneTapStart, handleStart, type SocialRuntime } from '@/features/socialLogin/http'
import { clearJwksCache } from '@/features/socialLogin/jwt'
import {
  EXTRA_PROVIDER_IDS,
  PROVIDER_IDS,
  emptySocialConfig,
  isUsable,
  missingCredentials,
  providerLabel,
  redirectUriFor,
  usesIdToken,
  type ProviderConfig,
  type ProviderId,
  type SocialConfig,
} from '@/features/socialLogin/providers'
import { usableProviders } from '@/features/socialLogin/settings'
import { SETUP_GUIDES, incompleteGuides } from '@/features/socialLogin/setupGuides'
import { b64urlEncode } from '@/features/socialLogin/util'

const ORIGIN = 'https://shop.example.com'
const SECRET = 'extra-test-secret'
const KID = 'k1'
const nowS = (): number => Math.floor(Date.now() / 1000)

let rsa: { privateKey: CryptoKey; jwk: JsonWebKey }

async function sign(claims: Record<string, unknown>): Promise<string> {
  const header = b64urlEncode(JSON.stringify({ alg: 'RS256', kid: KID, typ: 'JWT' }))
  const payload = b64urlEncode(JSON.stringify(claims))
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', rsa.privateKey, new TextEncoder().encode(`${header}.${payload}`)))
  return `${header}.${payload}.${b64urlEncode(sig)}`
}

type Call = { url: string; body: string; headers: Record<string, string> }
function fakeFetch(routes: Record<string, () => unknown>): { fetchImpl: typeof fetch; calls: Call[] } {
  const calls: Call[] = []
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input)
    const headers: Record<string, string> = {}
    new Headers(init?.headers).forEach((v, k) => (headers[k] = v))
    calls.push({ url, body: String(init?.body ?? ''), headers })
    const key = Object.keys(routes).find((k) => url.startsWith(k))
    if (!key) return new Response(JSON.stringify({ error: 'unexpected ' + url }), { status: 500 })
    return new Response(JSON.stringify(routes[key]()), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
  return { fetchImpl, calls }
}

const cfg = (patch: Partial<ProviderConfig>): ProviderConfig => ({ ...emptySocialConfig().providers.x, enabled: true, clientId: 'cid', clientSecret: 'csecret', ...patch })

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
  rsa = { privateKey: pair.privateKey, jwk: await crypto.subtle.exportKey('jwk', pair.publicKey) }
})

beforeEach(() => {
  clearJwksCache()
  clearDiscoveryCache()
})

describe('registry', () => {
  it('lists the new providers, with a complete guide and a redirect URL each', () => {
    expect(EXTRA_PROVIDER_IDS).toEqual(['x', 'linkedin', 'tiktok', 'slack', 'oidc'])
    expect(PROVIDER_IDS).toHaveLength(11)
    expect(incompleteGuides()).toEqual([])
    for (const id of EXTRA_PROVIDER_IDS) {
      expect(SETUP_GUIDES[id].steps.join(' ')).toContain('redirect')
      expect(redirectUriFor(ORIGIN, id)).toBe(`${ORIGIN}/api/social/${id}/callback`)
    }
  })

  it('needs complete credentials, and for the free-form provider somewhere to send people', () => {
    expect(missingCredentials('x', cfg({ clientSecret: '' }))).toEqual(['client secret'])
    expect(missingCredentials('tiktok', cfg({ clientId: '' }))).toEqual(['client key'])
    expect(missingCredentials('oidc', cfg({}))).toEqual(['discovery URL (or the authorize and token URLs)'])
    expect(missingCredentials('oidc', cfg({ discoveryUrl: 'https://idp.example.com/.well-known/openid-configuration' }))).toEqual([])
    expect(missingCredentials('oidc', cfg({ authUrl: 'https://idp.example.com/a', tokenUrl: 'https://idp.example.com/t' }))).toEqual([])
  })

  it('uses the owner button text for the free-form provider only', () => {
    expect(providerLabel('oidc', cfg({ label: ' Acme staff ' }))).toBe('Acme staff')
    expect(providerLabel('oidc', cfg({ label: '' }))).toBe('Single sign-on')
    expect(providerLabel('x', cfg({ label: 'ignored' }))).toBe('X')
  })

  it('reads saved rows into the config and keeps everything off by default', () => {
    const c = applyExtraRows(emptySocialConfig(), [])
    expect(usableProviders(c)).toEqual([])
    const rows: ExtraRow[] = [
      { provider: 'slack', enabled: true, clientId: 'a', clientSecret: 'b', redirectConfirmed: true, settings: {} },
      { provider: 'google-one-tap', enabled: true, clientId: '', clientSecret: '', redirectConfirmed: false, settings: {} },
    ]
    const withRows = applyExtraRows(emptySocialConfig(), rows)
    expect(usableProviders(withRows).map((p) => p.id)).toEqual(['slack'])
    expect(withRows.googleOneTap).toBe(true)
    expect(isUsable('x', withRows.providers.x)).toBe(false)
  })

  it('renders an icon and the right text on each new button', () => {
    const html = renderToStaticMarkup(React.createElement(SocialButtons, { providers: EXTRA_PROVIDER_IDS.map((id) => ({ id, label: providerLabel(id) })) }))
    for (const id of EXTRA_PROVIDER_IDS) expect(html).toContain(`/api/social/${id}/start?area=account`)
    expect(html.match(/<svg/g)).toHaveLength(5)
    expect(html).toContain('aria-hidden="true"')
  })
})

describe('authorize URLs', () => {
  const endpoints = (id: ProviderId, c: ProviderConfig) => resolveEndpoints(id, c, fakeFetch({}).fetchImpl)

  it('sends X a PKCE challenge, the X scopes and no secret', async () => {
    const c = cfg({})
    const url = new URL(await buildAuthorizeUrl('x', c, { redirectUri: 'https://s/cb', state: 's1', nonce: '', verifier: 'v'.repeat(50), endpoints: await endpoints('x', c) }))
    expect(url.origin + url.pathname).toBe('https://x.com/i/oauth2/authorize')
    expect(url.searchParams.get('scope')).toBe('users.read tweet.read users.email')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('nonce')).toBeNull()
    expect(url.toString()).not.toContain('csecret')
  })

  it('names TikTok client_key and separates scopes with commas', async () => {
    const c = cfg({})
    const url = new URL(await buildAuthorizeUrl('tiktok', c, { redirectUri: 'https://s/cb', state: 's1', nonce: '', verifier: '', endpoints: await endpoints('tiktok', c) }))
    expect(url.searchParams.get('client_key')).toBe('cid')
    expect(url.searchParams.get('client_id')).toBeNull()
    expect(url.searchParams.get('scope')).toBe('user.info.basic')
  })

  it('sends a nonce to LinkedIn and Slack (ID token providers) and none to TikTok', async () => {
    for (const id of ['linkedin', 'slack'] as const) {
      const c = cfg({})
      const url = new URL(await buildAuthorizeUrl(id, c, { redirectUri: 'https://s/cb', state: 's1', nonce: 'n1', verifier: '', endpoints: await endpoints(id, c) }))
      expect(url.searchParams.get('nonce')).toBe('n1')
      expect(url.searchParams.get('scope')).toBe('openid profile email'.split(' ').sort().join(' ') === '' ? '' : url.searchParams.get('scope'))
    }
    expect(usesIdToken('tiktok', cfg({}))).toBe(false)
    expect(usesIdToken('oidc', cfg({ scopes: 'profile' }))).toBe(false)
    expect(usesIdToken('oidc', cfg({ scopes: '' }))).toBe(true)
  })
})

describe('X and TikTok', () => {
  it('exchanges an X code with Basic client auth and trusts only a confirmed email', async () => {
    const c = cfg({})
    const { fetchImpl, calls } = fakeFetch({
      'https://api.x.com/2/oauth2/token': () => ({ access_token: 'at', token_type: 'bearer' }),
      'https://api.x.com/2/users/me': () => ({ data: { id: '77', username: 'pat', confirmed_email: 'Pat@Example.com' } }),
    })
    const identity = await exchangeForIdentity('x', c, { code: 'c', redirectUri: 'https://s/cb', verifier: 'ver', nonce: '', fetchImpl, endpoints: await resolveEndpoints('x', c, fetchImpl) })
    expect(identity).toEqual({ provider: 'x', providerUserId: '77', email: 'pat@example.com', emailVerified: true })
    expect(calls[0].headers.authorization).toBe(`Basic ${btoa('cid:csecret')}`)
    expect(calls[0].body).not.toContain('client_secret')
    expect(calls[0].body).toContain('code_verifier=ver')
  })

  it('treats an X account with no confirmed email as having none', async () => {
    const c = cfg({})
    const { fetchImpl } = fakeFetch({
      'https://api.x.com/2/oauth2/token': () => ({ access_token: 'at' }),
      'https://api.x.com/2/users/me': () => ({ data: { id: '78', username: 'sam' } }),
    })
    const identity = await exchangeForIdentity('x', c, { code: 'c', redirectUri: 'r', verifier: 'v', nonce: '', fetchImpl, endpoints: await resolveEndpoints('x', c, fetchImpl) })
    expect(identity).toMatchObject({ providerUserId: '78', email: null, emailVerified: false })
  })

  it('sends TikTok client_key and secret in the body and never reports an email', async () => {
    const c = cfg({})
    const { fetchImpl, calls } = fakeFetch({ 'https://open.tiktokapis.com/v2/oauth/token/': () => ({ access_token: 'at', open_id: 'open-1' }) })
    const identity = await exchangeForIdentity('tiktok', c, { code: 'c', redirectUri: 'r', verifier: '', nonce: '', fetchImpl, endpoints: await resolveEndpoints('tiktok', c, fetchImpl) })
    expect(identity).toEqual({ provider: 'tiktok', providerUserId: 'open-1', email: null, emailVerified: false })
    expect(calls[0].body).toContain('client_key=cid')
    expect(calls[0].body).toContain('client_secret=csecret')
  })

  it('refuses a token response that carries an error, including Slack\'s ok:false', async () => {
    const c = cfg({})
    const bad = fakeFetch({ 'https://slack.com/api/openid.connect.token': () => ({ ok: false, error: 'invalid_code' }) })
    await expect(exchangeForIdentity('slack', c, { code: 'c', redirectUri: 'r', verifier: '', nonce: 'n', fetchImpl: bad.fetchImpl, endpoints: await resolveEndpoints('slack', c, bad.fetchImpl) })).rejects.toMatchObject({ reason: 'exchange' })
  })
})

describe('LinkedIn and Slack (ID tokens)', () => {
  it('verifies a LinkedIn token, issuer, audience and nonce', async () => {
    const c = cfg({})
    const claims = { iss: 'https://www.linkedin.com/oauth', aud: 'cid', sub: 'li-1', email: 'a@b.com', email_verified: true, exp: nowS() + 300, iat: nowS(), nonce: 'n1' }
    const ok = fakeFetch({
      'https://www.linkedin.com/oauth/v2/accessToken': async () => ({ access_token: 'at', id_token: await sign(claims) }),
      'https://www.linkedin.com/oauth/openid/jwks': () => ({ keys: [{ ...rsa.jwk, kid: KID, alg: 'RS256' }] }),
    })
    // The fake route above is sync-only: pre-sign instead.
    const token = await sign(claims)
    const fixed = fakeFetch({
      'https://www.linkedin.com/oauth/v2/accessToken': () => ({ access_token: 'at', id_token: token }),
      'https://www.linkedin.com/oauth/openid/jwks': () => ({ keys: [{ ...rsa.jwk, kid: KID, alg: 'RS256' }] }),
    })
    void ok
    const args = { code: 'c', redirectUri: 'r', verifier: '', nonce: 'n1', fetchImpl: fixed.fetchImpl, endpoints: await resolveEndpoints('linkedin', c, fixed.fetchImpl) }
    expect(await exchangeForIdentity('linkedin', c, args)).toEqual({ provider: 'linkedin', providerUserId: 'li-1', email: 'a@b.com', emailVerified: true })
    await expect(exchangeForIdentity('linkedin', c, { ...args, nonce: 'other' })).rejects.toMatchObject({ reason: 'token-nonce' })
    await expect(exchangeForIdentity('linkedin', cfg({ clientId: 'someone-else' }), args)).rejects.toMatchObject({ reason: 'token-audience' })
  })

  it('refuses a Slack token from the wrong issuer', async () => {
    const c = cfg({})
    const token = await sign({ iss: 'https://evil.example', aud: 'cid', sub: 'U1', email: 'a@b.com', email_verified: true, exp: nowS() + 300, iat: nowS(), nonce: 'n' })
    const f = fakeFetch({
      'https://slack.com/api/openid.connect.token': () => ({ ok: true, access_token: 'at', id_token: token }),
      'https://slack.com/openid/connect/keys': () => ({ keys: [{ ...rsa.jwk, kid: KID, alg: 'RS256' }] }),
    })
    await expect(exchangeForIdentity('slack', c, { code: 'c', redirectUri: 'r', verifier: '', nonce: 'n', fetchImpl: f.fetchImpl, endpoints: await resolveEndpoints('slack', c, f.fetchImpl) })).rejects.toMatchObject({ reason: 'token-issuer' })
  })
})

describe('free-form OpenID Connect provider', () => {
  const DISCOVERY = 'https://idp.example.com/.well-known/openid-configuration'
  const doc = {
    issuer: 'https://idp.example.com',
    authorization_endpoint: 'https://idp.example.com/authorize',
    token_endpoint: 'https://idp.example.com/token',
    jwks_uri: 'https://idp.example.com/jwks',
    userinfo_endpoint: 'https://idp.example.com/userinfo',
  }

  it('reads endpoints from discovery, lets typed addresses win, and caches the document', async () => {
    const f = fakeFetch({ [DISCOVERY]: () => doc })
    const c = cfg({ discoveryUrl: DISCOVERY })
    expect(await resolveEndpoints('oidc', c, f.fetchImpl)).toEqual({
      authUrl: doc.authorization_endpoint,
      tokenUrl: doc.token_endpoint,
      jwksUrl: doc.jwks_uri,
      issuer: doc.issuer,
      userinfoUrl: doc.userinfo_endpoint,
    })
    expect((await resolveEndpoints('oidc', { ...c, tokenUrl: 'https://idp.example.com/other-token' }, f.fetchImpl)).tokenUrl).toBe('https://idp.example.com/other-token')
    expect(f.calls).toHaveLength(1)
  })

  it('refuses addresses that are not https on a public host, before calling them', async () => {
    for (const bad of ['http://idp.example.com/x', 'https://localhost/x', 'https://127.0.0.1/x', 'https://10.0.0.5/x', 'https://user:pw@idp.example.com/x', 'https://intranet/x', 'https://svc.internal/x', 'https://idp.example.com:8443/x', 'not a url']) {
      expect(isSafeHttpsUrl(bad)).toBe(false)
    }
    expect(isSafeHttpsUrl('https://idp.example.com/.well-known/openid-configuration')).toBe(true)
    const f = fakeFetch({})
    await expect(resolveEndpoints('oidc', cfg({ discoveryUrl: 'http://idp.example.com/x' }), f.fetchImpl)).rejects.toMatchObject({ reason: 'bad-endpoint' })
    expect(f.calls).toHaveLength(0)
    const hostile = fakeFetch({ [DISCOVERY]: () => ({ ...doc, token_endpoint: 'http://169.254.169.254/latest' }) })
    await expect(resolveEndpoints('oidc', cfg({ discoveryUrl: DISCOVERY }), hostile.fetchImpl)).rejects.toMatchObject({ reason: 'bad-endpoint' })
  })

  it('signs in against a test IdP, mapping custom claims, and refuses a wrong issuer or nonce', async () => {
    const c = cfg({ discoveryUrl: DISCOVERY, subjectClaim: 'uid', emailClaim: 'mail', verifiedClaim: 'mail_ok' })
    const claims = { iss: doc.issuer, aud: 'cid', uid: 'u-9', mail: 'Z@Example.org', mail_ok: true, exp: nowS() + 300, iat: nowS(), nonce: 'nn' }
    const token = await sign(claims)
    const f = fakeFetch({
      [DISCOVERY]: () => doc,
      [doc.token_endpoint]: () => ({ access_token: 'at', id_token: token }),
      [doc.jwks_uri]: () => ({ keys: [{ ...rsa.jwk, kid: KID, alg: 'RS256' }] }),
    })
    const args = { code: 'c', redirectUri: 'r', verifier: 'v', nonce: 'nn', fetchImpl: f.fetchImpl, endpoints: await resolveEndpoints('oidc', c, f.fetchImpl) }
    expect(await exchangeForIdentity('oidc', c, args)).toEqual({ provider: 'oidc', providerUserId: 'u-9', email: 'z@example.org', emailVerified: true })
    await expect(exchangeForIdentity('oidc', c, { ...args, nonce: 'x' })).rejects.toMatchObject({ reason: 'token-nonce' })
    await expect(exchangeForIdentity('oidc', c, { ...args, endpoints: { ...args.endpoints, issuer: 'https://someone-else.example.com' } })).rejects.toMatchObject({ reason: 'token-issuer' })
    await expect(exchangeForIdentity('oidc', c, { ...args, endpoints: { ...args.endpoints, issuer: null } })).rejects.toMatchObject({ reason: 'token-issuer' })
  })

  it('falls back to the user info endpoint when there is no ID token, and never trusts an unverified email', async () => {
    const c = cfg({ discoveryUrl: DISCOVERY, scopes: 'profile email' })
    const f = fakeFetch({
      [DISCOVERY]: () => doc,
      [doc.token_endpoint]: () => ({ access_token: 'at' }),
      [doc.userinfo_endpoint]: () => ({ sub: 's-1', email: 'a@b.co' }),
    })
    const args = { code: 'c', redirectUri: 'r', verifier: 'v', nonce: '', fetchImpl: f.fetchImpl, endpoints: await resolveEndpoints('oidc', c, f.fetchImpl) }
    expect(await exchangeForIdentity('oidc', c, args)).toEqual({ provider: 'oidc', providerUserId: 's-1', email: 'a@b.co', emailVerified: false })
    expect(await exchangeForIdentity('oidc', { ...c, trustEmail: true }, args)).toMatchObject({ emailVerified: true })
  })

  it('needs a subject claim', () => {
    expect(() => identityFromClaims('oidc', { email: 'a@b.co' }, cfg({}))).toThrow(FlowError)
  })
})

describe('saving settings', () => {
  const none: ExtraRow[] = []

  it('keeps a saved secret when the field is left blank, and refuses to switch on without credentials', () => {
    const saved: ExtraRow[] = [{ provider: 'x', enabled: false, clientId: 'old', clientSecret: 'keep-me', redirectConfirmed: false, settings: {} }]
    const ok = validateExtraInput('x', { enabled: true, clientId: 'new', clientSecret: '' }, saved)
    expect(ok).toMatchObject({ ok: true, row: { clientId: 'new', clientSecret: 'keep-me', enabled: true } })
    const refused = validateExtraInput('x', { enabled: true, clientId: '' }, none)
    expect(refused).toMatchObject({ ok: false })
    expect((refused as { message: string }).message).toContain('client ID')
  })

  it('validates the free-form addresses, scopes and claim names', () => {
    expect(validateExtraInput('oidc', { discoveryUrl: 'http://idp.example.com/x' }, none)).toMatchObject({ ok: false })
    expect(validateExtraInput('oidc', { scopes: 'openid <script>' }, none)).toMatchObject({ ok: false })
    expect(validateExtraInput('oidc', { emailClaim: 'a b' }, none)).toMatchObject({ ok: false })
    const ok = validateExtraInput('oidc', { enabled: true, clientId: 'a', clientSecret: 'b', discoveryUrl: 'https://idp.example.com/.well-known/openid-configuration', label: 'Acme', scopes: 'openid  email', trustEmail: true }, none)
    expect(ok).toMatchObject({ ok: true, row: { settings: { scopes: 'openid email', label: 'Acme', trustEmail: true } } })
    expect(configFromRow((ok as { row: ExtraRow }).row).label).toBe('Acme')
  })

  it('refuses an unknown provider id', () => {
    expect(validateExtraInput('google', {}, none)).toEqual({ ok: false, message: 'Unknown provider.' })
  })
})

// --- The start route and One Tap -------------------------------------------

function runtime(config: SocialConfig, over: Partial<SocialRuntime> = {}, f = fakeFetch({})): SocialRuntime & { audits: string[]; logins: number[] } {
  const audits: string[] = []
  const logins: number[] = []
  const rt: SocialRuntime = {
    secret: SECRET,
    fetchImpl: f.fetchImpl,
    now: () => Date.now(),
    origin: () => ORIGIN,
    readConfig: async () => config,
    policy: () => ({
      store: {
        findByProviderUser: async () => null,
        listForUser: async () => [],
        insert: async () => {},
        touchLogin: async () => {},
        remove: async () => true,
      },
      settings: { allowSignup: true, allowAdmin: false, requireVerification: false },
      findUserByEmail: async () => null,
      findUserByID: async (id: number) => ({ id, email: 'new@example.com', roles: ['customer'], emailVerifiedAt: 'now' }),
      createCustomer: async () => {
        logins.push(501)
        return 501
      },
      markEmailVerified: async () => {},
    }),
    sessionUser: async () => null,
    login: async (userId) => ({ token: `tok-${userId}` }),
    audit: async (action) => void audits.push(action),
    limited: async () => false,
    sessionCookie: { name: 'engage-token', maxAgeSeconds: 7200 },
    ...over,
  }
  return Object.assign(rt, { audits, logins })
}

describe('start route for a new provider', () => {
  it('is a 404 until switched on and complete, then redirects with the right parameters', async () => {
    const off = runtime(emptySocialConfig())
    expect((await handleStart(new Request(`${ORIGIN}/api/social/x/start`), 'x', off)).status).toBe(404)

    const config = emptySocialConfig()
    config.providers.x = cfg({})
    const res = await handleStart(new Request(`${ORIGIN}/api/social/x/start`), 'x', runtime(config))
    expect(res.status).toBe(303)
    const url = new URL(res.headers.get('location') ?? '')
    expect(url.origin).toBe('https://x.com')
    expect(url.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/api/social/x/callback`)
  })

  it('sends the person back with a clear code when the free-form discovery fails', async () => {
    const config = emptySocialConfig()
    config.providers.oidc = cfg({ discoveryUrl: 'http://idp.example.com/x' })
    const res = await handleStart(new Request(`${ORIGIN}/api/social/oidc/start`), 'oidc', runtime(config))
    expect(res.headers.get('location')).toContain('social_error=bad-endpoint')
  })
})

describe('Google One Tap', () => {
  const oneTapConfig = (on = true): SocialConfig => {
    const c = emptySocialConfig()
    c.providers.google = { ...c.providers.google, enabled: true, clientId: 'g-client', clientSecret: 'g-secret' }
    c.googleOneTap = on
    return c
  }
  const jwks = () => ({ keys: [{ ...rsa.jwk, kid: KID, alg: 'RS256' }] })

  async function begin(rt: SocialRuntime) {
    const res = await handleOneTapStart(new Request(`${ORIGIN}/api/social/one-tap?next=/account/orders`), rt)
    const body = (await res.json()) as { clientId?: string; nonce?: string; state?: string }
    return { res, body, cookie: (res.headers.get('set-cookie') ?? '').split(';')[0] }
  }
  const post = (rt: SocialRuntime, payload: unknown, cookie: string, origin: string | null = ORIGIN) =>
    handleOneTapSignIn(
      new Request(`${ORIGIN}/api/social/one-tap`, { method: 'POST', headers: { 'content-type': 'application/json', cookie, ...(origin ? { origin } : {}) }, body: JSON.stringify(payload) }),
      rt,
    )

  it('is a 404 when off, or when Google itself is not complete', async () => {
    expect((await handleOneTapStart(new Request(`${ORIGIN}/api/social/one-tap`), runtime(oneTapConfig(false)))).status).toBe(404)
    const noGoogle = emptySocialConfig()
    noGoogle.googleOneTap = true
    expect((await handleOneTapStart(new Request(`${ORIGIN}/api/social/one-tap`), runtime(noGoogle))).status).toBe(404)
    expect((await post(runtime(oneTapConfig(false)), {}, '')).status).toBe(404)
  })

  it('hands out the public client ID and a nonce, never the secret', async () => {
    const { body, res } = await begin(runtime(oneTapConfig()))
    expect(body.clientId).toBe('g-client')
    expect(body.nonce).toBeTruthy()
    expect(JSON.stringify(body)).not.toContain('g-secret')
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  async function credential(over: Record<string, unknown> = {}, nonce = ''): Promise<string> {
    return sign({ iss: 'https://accounts.google.com', aud: 'g-client', sub: 'g-1', email: 'new@example.com', email_verified: true, exp: nowS() + 300, iat: nowS(), nonce, ...over })
  }

  it('signs in with a valid credential, setting the session cookie', async () => {
    const f = fakeFetch({ 'https://www.googleapis.com/oauth2/v3/certs': jwks })
    const rt = runtime(oneTapConfig(), {}, f)
    const { body, cookie } = await begin(rt)
    const res = await post(rt, { credential: await credential({}, body.nonce), state: body.state }, cookie)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, redirect: '/account/orders' })
    expect((res.headers.getSetCookie?.() ?? []).join(';')).toContain('engage-token=tok-501')
    expect(rt.audits).toContain('social.login')
  })

  it('refuses a wrong nonce, wrong audience, missing state, other origin and a replay without the cookie', async () => {
    const f = fakeFetch({ 'https://www.googleapis.com/oauth2/v3/certs': jwks })
    const rt = runtime(oneTapConfig(), {}, f)
    const { body, cookie } = await begin(rt)
    expect((await post(rt, { credential: await credential({}, 'other-nonce'), state: body.state }, cookie)).status).toBe(400)
    expect((await post(rt, { credential: await credential({ aud: 'someone-else' }, body.nonce), state: body.state }, cookie)).status).toBe(400)
    expect((await post(rt, { credential: await credential({}, body.nonce), state: 'wrong' }, cookie)).status).toBe(400)
    expect((await post(rt, { credential: await credential({}, body.nonce), state: body.state }, '')).status).toBe(400)
    expect((await post(rt, { credential: await credential({}, body.nonce), state: body.state }, cookie, 'https://evil.example')).status).toBe(403)
    expect((await post(rt, { credential: await credential({}, body.nonce), state: body.state }, cookie, null)).status).toBe(403)
    expect(rt.logins).toEqual([])
  })

  it('applies the usual rules: an unverified email creates and links nothing', async () => {
    const f = fakeFetch({ 'https://www.googleapis.com/oauth2/v3/certs': jwks })
    const rt = runtime(oneTapConfig(), {}, f)
    const { body, cookie } = await begin(rt)
    const res = await post(rt, { credential: await credential({ email_verified: false }, body.nonce), state: body.state }, cookie)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ ok: false, code: 'unverified-email' })
    expect(rt.logins).toEqual([])
    expect(rt.audits).toContain('social.refused')
  })
})
