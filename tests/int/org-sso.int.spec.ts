// @vitest-environment node
// Task 25a: single sign-on per organisation (OpenID Connect). A fake identity provider and fake stores only.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  connectionForEmail,
  discoveryUrlFor,
  emailDomain,
  enforcingConnection,
  normaliseDomain,
  txtProves,
  validateConnectionInput,
  verificationRecord,
  type SsoConnection,
} from '@/features/orgSso/core'
import { passwordBlockedBySso } from '@/features/orgSso/enforce'
import { handleSsoCallback, handleSsoStart, SSO_STATE_COOKIE, type SsoRuntime } from '@/features/orgSso/http'
import { completeSso, lookupTxt, type SsoDeps, type SsoUser } from '@/features/orgSso/service'
import { clearDiscoveryCache } from '@/features/socialLogin/endpoints'
import { clearJwksCache } from '@/features/socialLogin/jwt'
import { b64urlEncode } from '@/features/socialLogin/util'

const ORIGIN = 'https://shop.example.com'
const ISSUER = 'https://login.acme.example.com'
const SECRET = 'sso-test-secret'
const KID = 'k1'
const nowS = (): number => Math.floor(Date.now() / 1000)

let rsa: { privateKey: CryptoKey; jwk: JsonWebKey }
beforeAll(async () => {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
  rsa = { privateKey: pair.privateKey, jwk: await crypto.subtle.exportKey('jwk', pair.publicKey) }
})

async function sign(claims: Record<string, unknown>): Promise<string> {
  const header = b64urlEncode(JSON.stringify({ alg: 'RS256', kid: KID, typ: 'JWT' }))
  const payload = b64urlEncode(JSON.stringify(claims))
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', rsa.privateKey, new TextEncoder().encode(`${header}.${payload}`)))
  return `${header}.${payload}.${b64urlEncode(sig)}`
}

const conn = (patch: Partial<SsoConnection> = {}): SsoConnection => ({
  id: 'c1',
  orgId: 'org1',
  name: 'Acme',
  issuer: ISSUER,
  clientId: 'cid',
  clientSecret: 'csecret',
  domains: [{ domain: 'acme.com', token: 't', verifiedAt: '2027-01-01T00:00:00Z' }],
  defaultRole: 'member',
  jit: true,
  enforce: false,
  enabled: true,
  ...patch,
})

describe('core rules', () => {
  it('normalises domains and reads the domain of an address', () => {
    expect(normaliseDomain(' @ACME.com. ')).toBe('acme.com')
    expect(normaliseDomain('localhost')).toBeNull()
    expect(normaliseDomain('a b.com')).toBeNull()
    expect(normaliseDomain('1.2.3.4')).toBeNull()
    expect(emailDomain('Ann@Acme.com')).toBe('acme.com')
    expect(emailDomain('nobody')).toBeNull()
  })
  it('builds and checks the DNS proof', () => {
    const r = verificationRecord('acme.com', 'abc')
    expect(r).toEqual({ name: '_engage-sso.acme.com', value: 'engage-sso-verify=abc' })
    expect(txtProves(['"engage-sso-verify=abc"'], r.value)).toBe(true)
    expect(txtProves(['"engage-sso-" "verify=abc"'], r.value)).toBe(true)
    expect(txtProves(['"engage-sso-verify=other"', 'v=spf1'], r.value)).toBe(false)
  })
  it('matches a connection only for an enabled connection with the domain verified', () => {
    expect(connectionForEmail([conn()], 'a@acme.com')?.id).toBe('c1')
    expect(connectionForEmail([conn()], 'a@other.com')).toBeNull()
    expect(connectionForEmail([conn({ enabled: false })], 'a@acme.com')).toBeNull()
    expect(connectionForEmail([conn({ domains: [{ domain: 'acme.com', token: 't', verifiedAt: null }] })], 'a@acme.com')).toBeNull()
    expect(enforcingConnection([conn()], 'a@acme.com')).toBeNull()
    expect(enforcingConnection([conn({ enforce: true })], 'a@acme.com')?.id).toBe('c1')
  })
  it('validates input: https issuer, no owner role, secret required on create', () => {
    const base = { orgId: 'o', name: 'n', issuer: ISSUER, clientId: 'c', clientSecret: 's' }
    expect(validateConnectionInput(base, { requireSecret: true }).ok).toBe(true)
    expect(validateConnectionInput({ ...base, issuer: 'http://idp.example.com' }, { requireSecret: true }).ok).toBe(false)
    expect(validateConnectionInput({ ...base, issuer: 'https://10.0.0.1' }, { requireSecret: true }).ok).toBe(false)
    expect(validateConnectionInput({ ...base, defaultRole: 'owner' }, { requireSecret: true }).ok).toBe(false)
    expect(validateConnectionInput({ ...base, clientSecret: '' }, { requireSecret: true }).ok).toBe(false)
    expect(validateConnectionInput({ ...base, clientSecret: '' }, { requireSecret: false }).ok).toBe(true)
    expect(discoveryUrlFor(`${ISSUER}/`)).toBe(`${ISSUER}/.well-known/openid-configuration`)
  })
})

function fakeDeps(users: SsoUser[] = []): SsoDeps & { links: Map<string, number>; members: Array<[string, number, string]>; users: SsoUser[] } {
  const links = new Map<string, number>()
  const members: Array<[string, number, string]> = []
  let nextId = 100
  return {
    links,
    members,
    users,
    findLink: async (c, s) => links.get(`${c}:${s}`) ?? null,
    insertLink: async (c, s, u) => void links.set(`${c}:${s}`, u),
    findUserByID: async (id) => users.find((u) => u.id === id) ?? null,
    findUserByEmail: async (e) => users.find((u) => u.email === e) ?? null,
    createCustomer: async (email) => {
      const id = nextId++
      users.push({ id, email, roles: ['customer'] })
      return id
    },
    ensureMember: async (o, u, r) => void members.push([o, u, r]),
  }
}

describe('completeSso rules', () => {
  const id = { subject: 's1', email: 'ann@acme.com', emailVerified: true }
  it('refuses a missing, unverified or foreign-domain address', async () => {
    const d = fakeDeps()
    expect(await completeSso(d, conn(), { ...id, email: null })).toMatchObject({ ok: false, code: 'no-email' })
    expect(await completeSso(d, conn(), { ...id, emailVerified: false })).toMatchObject({ code: 'unverified-email' })
    expect(await completeSso(d, conn(), { ...id, email: 'ann@evil.com' })).toMatchObject({ code: 'domain' })
    expect(await completeSso(d, conn({ domains: [{ domain: 'acme.com', token: 't', verifiedAt: null }] }), id)).toMatchObject({ code: 'domain' })
    expect(d.users).toHaveLength(0)
  })
  it('creates a customer and membership on first sign-in, then recognises the link', async () => {
    const d = fakeDeps()
    const first = await completeSso(d, conn(), id)
    expect(first).toMatchObject({ ok: true, created: true })
    expect(d.users[0].roles).toEqual(['customer'])
    expect(d.members).toEqual([['org1', first.userId, 'member']])
    const again = await completeSso(d, conn(), { ...id, email: 'changed@acme.com' })
    expect(again).toMatchObject({ ok: true, created: false, userId: first.userId })
  })
  it('links an existing customer but never a staff account', async () => {
    const d = fakeDeps([{ id: 5, email: 'ann@acme.com', roles: ['customer'] }])
    expect(await completeSso(d, conn(), id)).toMatchObject({ ok: true, userId: 5, created: false })
    const staff = fakeDeps([{ id: 6, email: 'ann@acme.com', roles: ['admin'] }])
    expect(await completeSso(staff, conn(), id)).toMatchObject({ ok: false, code: 'staff-account' })
    expect(staff.links.size).toBe(0)
  })
  it('refuses a new person when just-in-time creation is off', async () => {
    const d = fakeDeps()
    expect(await completeSso(d, conn({ jit: false }), id)).toMatchObject({ ok: false, code: 'signup-disabled' })
  })
  it('uses the connection default role for new members', async () => {
    const d = fakeDeps()
    await completeSso(d, conn({ defaultRole: 'admin' }), id)
    expect(d.members[0][2]).toBe('admin')
  })
})

describe('enforcement', () => {
  const base = { featureOn: async () => true, listConnections: async () => [conn({ enforce: true })] }
  it('blocks password sign-in for a customer on an enforced domain only', async () => {
    expect(await passwordBlockedBySso({ ...base, email: 'ann@acme.com', rolesOf: async () => ['customer'] })).toBe(true)
    expect(await passwordBlockedBySso({ ...base, email: 'ann@acme.com', rolesOf: async () => null })).toBe(true)
    expect(await passwordBlockedBySso({ ...base, email: 'ann@other.com', rolesOf: async () => ['customer'] })).toBe(false)
  })
  it('never blocks staff, and does nothing when the feature is off or not enforced', async () => {
    expect(await passwordBlockedBySso({ ...base, email: 'ann@acme.com', rolesOf: async () => ['admin'] })).toBe(false)
    expect(await passwordBlockedBySso({ ...base, featureOn: async () => false, email: 'ann@acme.com', rolesOf: async () => [] })).toBe(false)
    expect(await passwordBlockedBySso({ ...base, listConnections: async () => [conn()], email: 'ann@acme.com', rolesOf: async () => [] })).toBe(false)
  })
})

describe('DNS lookup', () => {
  it('reads TXT answers and reports a failed lookup as null', async () => {
    const ok = (async () => new Response(JSON.stringify({ Answer: [{ type: 16, data: '"engage-sso-verify=x"' }, { type: 1, data: '1.2.3.4' }] }), { status: 200 })) as unknown as typeof fetch
    expect(await lookupTxt('_engage-sso.acme.com', ok)).toEqual(['"engage-sso-verify=x"'])
    const bad = (async () => new Response('no', { status: 500 })) as unknown as typeof fetch
    expect(await lookupTxt('x', bad)).toBeNull()
    const boom = (async () => {
      throw new Error('net')
    }) as unknown as typeof fetch
    expect(await lookupTxt('x', boom)).toBeNull()
  })
})

describe('the sign-in flow end to end', () => {
  let deps: ReturnType<typeof fakeDeps>
  let audits: string[]
  let connection: SsoConnection
  let nonceSeen = ''

  const idp = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input)
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } })
    if (url.endsWith('/.well-known/openid-configuration')) {
      return json({ issuer: ISSUER, authorization_endpoint: `${ISSUER}/authorize`, token_endpoint: `${ISSUER}/token`, jwks_uri: `${ISSUER}/jwks` })
    }
    if (url === `${ISSUER}/jwks`) return json({ keys: [{ ...rsa.jwk, kid: KID, alg: 'RS256', use: 'sig' }] })
    if (url === `${ISSUER}/token`) {
      return json({ id_token: await sign({ iss: ISSUER, aud: 'cid', sub: 'user-1', email: 'ann@acme.com', email_verified: true, nonce: nonceSeen, iat: nowS(), exp: nowS() + 300 }) })
    }
    return new Response('unexpected ' + url + String(init?.method), { status: 500 })
  }) as typeof fetch

  const runtime = (): SsoRuntime => ({
    secret: SECRET,
    fetchImpl: idp,
    now: () => Date.now(),
    origin: () => ORIGIN,
    login: async (userId) => ({ token: `tok-${userId}` }),
    audit: async (_a, _r, e) => void audits.push(e.detail),
    limited: async () => false,
    sessionCookie: { name: 'engage-token', maxAgeSeconds: 7200 },
    listConnections: async () => [connection],
    getConnection: async (id) => (id === connection.id ? connection : null),
    deps,
  })

  beforeEach(() => {
    clearJwksCache()
    clearDiscoveryCache()
    deps = fakeDeps()
    audits = []
    connection = conn()
    nonceSeen = ''
  })

  const begin = async (email: string) => {
    const res = await handleSsoStart(new Request(`${ORIGIN}/api/sso/start?email=${encodeURIComponent(email)}`), runtime())
    const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]
    return { res, cookie, location: res.headers.get('location') ?? '' }
  }

  it('shows a form with no email and a neutral redirect for an unknown domain', async () => {
    const form = await handleSsoStart(new Request(`${ORIGIN}/api/sso/start`), runtime())
    expect(form.status).toBe(200)
    expect(await form.text()).toContain('<form')
    const unknown = await begin('x@nowhere.com')
    expect(unknown.res.status).toBe(303)
    expect(unknown.location).toBe(`${ORIGIN}/api/sso/start?error=1`)
    expect(unknown.cookie).toBe('')
  })

  it('signs in a new person, sets the session, and creates the membership', async () => {
    const { res, cookie, location } = await begin('ann@acme.com')
    expect(res.status).toBe(303)
    const url = new URL(location)
    expect(url.origin + url.pathname).toBe(`${ISSUER}/authorize`)
    expect(url.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/api/sso/callback`)
    expect(url.searchParams.get('login_hint')).toBe('ann@acme.com')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    nonceSeen = url.searchParams.get('nonce') ?? ''
    const back = await handleSsoCallback(
      new Request(`${ORIGIN}/api/sso/callback?code=abc&state=${url.searchParams.get('state')}`, { headers: { cookie } }),
      runtime(),
    )
    expect(back.status).toBe(303)
    expect(back.headers.get('location')).toBe(`${ORIGIN}/account`)
    expect(back.headers.getSetCookie().some((c) => c.startsWith('engage-token=tok-'))).toBe(true)
    expect(deps.members[0]).toMatchObject([ 'org1', expect.any(Number), 'member' ])
    expect(audits.some((a) => a.includes('signed in (new account)'))).toBe(true)
  })

  it('refuses a callback with no state cookie, a wrong state, or a disabled connection', async () => {
    const { cookie, location } = await begin('ann@acme.com')
    const state = new URL(location).searchParams.get('state')
    nonceSeen = new URL(location).searchParams.get('nonce') ?? ''
    const none = await handleSsoCallback(new Request(`${ORIGIN}/api/sso/callback?code=abc&state=${state}`), runtime())
    expect(none.headers.get('location')).toContain('sso_error=state')
    const wrong = await handleSsoCallback(new Request(`${ORIGIN}/api/sso/callback?code=abc&state=nope`, { headers: { cookie } }), runtime())
    expect(wrong.headers.get('location')).toContain('sso_error=state')
    connection = conn({ enabled: false })
    const off = await handleSsoCallback(new Request(`${ORIGIN}/api/sso/callback?code=abc&state=${state}`, { headers: { cookie } }), runtime())
    expect(off.headers.get('location')).toContain('sso_error=unavailable')
    expect(deps.users).toHaveLength(0)
    expect(cookie.startsWith(SSO_STATE_COOKIE)).toBe(true)
  })

  it('refuses when the provider vouches for an address outside the verified domains', async () => {
    connection = conn({ domains: [{ domain: 'other.com', token: 't', verifiedAt: '2027-01-01T00:00:00Z' }] })
    // The start step needs a matching domain; begin with an address on that domain, but the provider answers ann@acme.com.
    const { cookie, location } = await begin('bob@other.com')
    nonceSeen = new URL(location).searchParams.get('nonce') ?? ''
    const back = await handleSsoCallback(new Request(`${ORIGIN}/api/sso/callback?code=abc&state=${new URL(location).searchParams.get('state')}`, { headers: { cookie } }), runtime())
    expect(back.headers.get('location')).toContain('sso_error=domain')
    expect(deps.users).toHaveLength(0)
  })
})
