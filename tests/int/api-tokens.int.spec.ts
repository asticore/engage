// @vitest-environment node
// Task 23i: access tokens (ES256 + JWKS), signing key rotation, one-time tokens and the three endpoints.
// Stores are in-memory doubles; the keys are real ECDSA keys, signed and verified with Web Crypto.
import { describe, expect, it } from 'vitest'

import { authenticateApiKey, generateApiKey, hashApiKey, presentedApiKey, type ApiKeyDeps, type ApiKeyRow, type ApiKeyStore } from '@/features/apiKeys'
import { signAccessToken, verifyAccessToken } from '@/features/apiKeys/tokens/accessToken'
import { handleOneTimeCreate, handleOneTimeVerify, handleTokenExchange, type TokenCaller, type TokenRuntime } from '@/features/apiKeys/tokens/http'
import { consumeOneTimeToken, hashOneTimeToken, issueOneTimeToken, type OneTimeStore } from '@/features/apiKeys/tokens/oneTime'
import { currentSigningKey, publishedKeys, RETIRED_KEEP_MS, ROTATE_AFTER_MS, rotateSigningKeys, type SigningKeyRow, type SigningKeyStore } from '@/features/apiKeys/tokens/signingKeys'
import { DEFAULT_API_KEY_SETTINGS } from '@/features/security/settings'

type Json = { access_token: string; error: string; purpose: string; token: string; [key: string]: unknown }
const read = async (res: Response): Promise<Json> => (await res.json()) as Json

const NOW = Date.parse('2026-11-16T10:00:00.000Z')

function memoryKeys(): SigningKeyStore & { rows: SigningKeyRow[] } {
  const rows: SigningKeyRow[] = []
  return {
    rows,
    async list() {
      return rows.map((r) => ({ ...r }))
    },
    async insert(row) {
      rows.push({ ...row })
    },
    async retire(kid, at) {
      const row = rows.find((r) => r.kid === kid)
      if (row && !row.retiredAt) row.retiredAt = at
    },
    async remove(kid) {
      const i = rows.findIndex((r) => r.kid === kid)
      if (i >= 0) rows.splice(i, 1)
    },
  }
}

function memoryOneTime(): OneTimeStore {
  const rows: Array<{ tokenHash: string; purpose: string; userId: number | null; payload: string | null; createdAt: string; expiresAt: string; usedAt: string | null }> = []
  return {
    async insert(row) {
      rows.push({ ...row, usedAt: null })
    },
    async claim(tokenHash, purpose, at) {
      const row = rows.find((r) => r.tokenHash === tokenHash && r.purpose === purpose && !r.usedAt && r.expiresAt > at)
      if (!row) return false
      row.usedAt = at
      return true
    },
    async read(tokenHash) {
      const row = rows.find((r) => r.tokenHash === tokenHash)
      return row ? { purpose: row.purpose, userId: row.userId, payload: row.payload, createdAt: row.createdAt } : null
    },
    async purge() {},
  }
}

describe('signing keys', () => {
  it('makes a key on first use and reuses it until it is 30 days old', async () => {
    const store = memoryKeys()
    const first = await currentSigningKey(store, NOW)
    expect((await currentSigningKey(store, NOW + ROTATE_AFTER_MS - 1000)).kid).toBe(first.kid)
    const next = await currentSigningKey(store, NOW + ROTATE_AFTER_MS + 1000)
    expect(next.kid).not.toBe(first.kid)
    expect(store.rows.find((r) => r.kid === first.kid)?.retiredAt).not.toBeNull()
  })

  it('publishes public halves only and drops a retired key after the keep window', async () => {
    const store = memoryKeys()
    const first = await currentSigningKey(store, NOW)
    await rotateSigningKeys(store, NOW + 1000)
    const listed = await publishedKeys(store, NOW + 2000)
    expect(listed).toHaveLength(2)
    expect(JSON.stringify(listed)).not.toContain('"d"')
    expect(listed.every((k) => k.alg === 'ES256' && k.use === 'sig' && k.kty === 'EC')).toBe(true)
    const later = NOW + 1000 + RETIRED_KEEP_MS + 5000
    expect((await publishedKeys(store, later)).some((k) => k.kid === first.kid)).toBe(false)
  })
})

describe('access tokens', () => {
  const input = { issuer: 'https://site.test', userId: 7, keyId: 3, scopes: ['pages:read'], seconds: 900, now: NOW }

  it('signs and verifies, and carries the key, owner and scope', async () => {
    const store = memoryKeys()
    const { token } = await signAccessToken(store, input)
    const verified = await verifyAccessToken(store, token, NOW + 1000)
    expect(verified).toMatchObject({ userId: 7, keyId: 3, scopes: ['pages:read'] })
  })

  it('refuses a token that is expired, tampered with, signed by an unknown key or not ES256', async () => {
    const store = memoryKeys()
    const { token } = await signAccessToken(store, input)
    expect(await verifyAccessToken(store, token, NOW + 900_000 + 120_000)).toBeNull()
    const [h, p, s] = token.split('.')
    const forged = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')))
    forged.sub = '1'
    const forgedPayload = btoa(JSON.stringify(forged)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(await verifyAccessToken(store, `${h}.${forgedPayload}.${s}`, NOW + 1000)).toBeNull()
    expect(await verifyAccessToken(memoryKeys(), token, NOW + 1000)).toBeNull()
    const none = btoa(JSON.stringify({ alg: 'none', typ: 'at+jwt', kid: 'x' })).replace(/=+$/, '')
    expect(await verifyAccessToken(store, `${none}.${p}.`, NOW + 1000)).toBeNull()
    expect(await verifyAccessToken(store, `${none}.${p}.${s}`, NOW + 1000)).toBeNull()
  })

  it('still verifies after a rotation, until the old key is purged', async () => {
    const store = memoryKeys()
    const { token } = await signAccessToken(store, input)
    await rotateSigningKeys(store, NOW + 60_000)
    expect(await verifyAccessToken(store, token, NOW + 120_000)).not.toBeNull()
  })

  it('is picked up as a bearer credential, while a session JWT and other tokens are not', async () => {
    const store = memoryKeys()
    const { token } = await signAccessToken(store, input)
    expect(presentedApiKey({ get: (n) => (n === 'Authorization' ? `Bearer ${token}` : null) })).toBe(token)
    const session = `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=+$/, '')}.e30.sig`
    expect(presentedApiKey({ get: (n) => (n === 'Authorization' ? `Bearer ${session}` : null) })).toBeNull()
  })
})

describe('authenticateApiKey with an access token', () => {
  async function setup(over: Partial<ApiKeyRow> = {}) {
    const keys = memoryKeys()
    const secret = generateApiKey()
    const row: ApiKeyRow = {
      id: 3, userId: 7, name: 'ci', prefix: secret.slice(0, 8), keyHash: await hashApiKey(secret),
      scopes: ['pages:read', 'posts:write'], createdAt: new Date(NOW).toISOString(), lastUsedAt: new Date(NOW).toISOString(), expiresAt: null, revokedAt: null, ...over,
    }
    const store: ApiKeyStore = {
      insert: async () => 1, findByHash: async () => row, findById: async (id) => (id === row.id ? row : null),
      listForUser: async () => [row], listAll: async () => [row], touch: async () => {}, revoke: async () => {},
    }
    const deps: ApiKeyDeps = {
      store, now: () => NOW + 1000, audit: async () => {},
      loadOwner: async () => ({ id: 7, email: 'a@b.c', roles: ['admin'], locked: false, user: {} }),
      verifyAccessToken: async (t) => verifyAccessToken(keys, t, NOW + 1000),
    }
    const { token } = await signAccessToken(keys, { issuer: 'https://site.test', userId: 7, keyId: 3, scopes: ['pages:read'], seconds: 900, now: NOW })
    return { deps, token, row }
  }
  const on = { ...DEFAULT_API_KEY_SETTINGS, enabled: true }

  it('lets the token act as its key, narrowed to the token scope', async () => {
    const { deps, token } = await setup()
    const { key } = await authenticateApiKey(deps, token, on)
    expect(key.scopes).toEqual(['pages:read'])
  })

  it('stops working the moment the key is revoked or expires', async () => {
    const revoked = await setup({ revokedAt: new Date(NOW).toISOString() })
    await expect(authenticateApiKey(revoked.deps, revoked.token, on)).rejects.toMatchObject({ reason: 'revoked' })
    const expired = await setup({ expiresAt: new Date(NOW - 1).toISOString() })
    await expect(authenticateApiKey(expired.deps, expired.token, on)).rejects.toMatchObject({ reason: 'expired' })
  })

  it('refuses a token when tokens are not wired, and when API keys are off', async () => {
    const { deps, token } = await setup()
    await expect(authenticateApiKey({ ...deps, verifyAccessToken: undefined }, token, on)).rejects.toMatchObject({ reason: 'malformed' })
    await expect(authenticateApiKey(deps, token, { ...on, enabled: false })).rejects.toMatchObject({ reason: 'disabled' })
  })
})

describe('one-time tokens', () => {
  it('works once, only for its purpose, and not after it expires', async () => {
    const store = memoryOneTime()
    const made = await issueOneTimeToken(store, { purpose: 'app:invite', userId: 7, payload: { page: 'x' }, seconds: 60, now: NOW })
    if (!made.ok) throw new Error('expected ok')
    expect(await consumeOneTimeToken(store, made.token, 'app:other', NOW + 1000)).toBeNull()
    const used = await consumeOneTimeToken(store, made.token, 'app:invite', NOW + 1000)
    expect(used).toMatchObject({ userId: 7, payload: { page: 'x' } })
    expect(await consumeOneTimeToken(store, made.token, 'app:invite', NOW + 2000)).toBeNull()
    const late = await issueOneTimeToken(store, { purpose: 'app:invite', userId: 7, seconds: 5, now: NOW })
    if (!late.ok) throw new Error('expected ok')
    expect(await consumeOneTimeToken(store, late.token, 'app:invite', NOW + 6000)).toBeNull()
  })

  it('stores only a hash and rejects bad input', async () => {
    const store = memoryOneTime()
    const made = await issueOneTimeToken(store, { purpose: 'app:x', userId: null, now: NOW })
    if (!made.ok) throw new Error('expected ok')
    expect(await hashOneTimeToken(made.token)).toHaveLength(64)
    expect((await issueOneTimeToken(store, { purpose: 'Bad Purpose!', userId: 1, now: NOW })).ok).toBe(false)
    expect((await issueOneTimeToken(store, { purpose: 'app:x', userId: 1, seconds: 99999, now: NOW })).ok).toBe(false)
    expect((await issueOneTimeToken(store, { purpose: 'app:x', userId: 1, payload: 'y'.repeat(2000), now: NOW })).ok).toBe(false)
  })

  it('lets exactly one of two simultaneous uses win', async () => {
    const store = memoryOneTime()
    const made = await issueOneTimeToken(store, { purpose: 'app:race', userId: 1, now: NOW })
    if (!made.ok) throw new Error('expected ok')
    const results = await Promise.all([consumeOneTimeToken(store, made.token, 'app:race', NOW + 10), consumeOneTimeToken(store, made.token, 'app:race', NOW + 10)])
    expect(results.filter(Boolean)).toHaveLength(1)
  })
})

describe('endpoints', () => {
  function runtime(over: { roles?: string[]; refuse?: number; limited?: boolean } = {}) {
    const audits: string[] = []
    const caller: TokenCaller = { key: { id: 3, userId: 7, name: 'ci', scopes: ['pages:read', 'posts:write'] }, owner: { id: 7, email: 'a@b.c', roles: over.roles ?? ['admin'] } }
    const rt: TokenRuntime = {
      now: () => NOW,
      origin: () => 'https://site.test',
      authenticate: async () => {
        if (over.refuse) throw Object.assign(new Error('x'), { status: over.refuse })
        return caller
      },
      keys: memoryKeys(),
      oneTime: memoryOneTime(),
      limit: () => ({ limited: over.limited === true, retryAfterSeconds: 9 }),
      audit: async (e) => void audits.push(e.action),
    }
    return { rt, audits }
  }
  const post = (body: unknown, auth = `Bearer ${generateApiKey()}`) =>
    new Request('https://site.test/api/auth/token', { method: 'POST', headers: { 'content-type': 'application/json', authorization: auth }, body: JSON.stringify(body) })

  it('exchanges a key for a token, defaulting to 15 minutes and the key scopes', async () => {
    const { rt, audits } = runtime()
    const res = await handleTokenExchange(post({}), rt)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = await read(res)
    expect(body).toMatchObject({ token_type: 'Bearer', expires_in: 900, scope: 'pages:read posts:write' })
    expect(await verifyAccessToken(rt.keys, body.access_token, NOW + 1000)).toMatchObject({ keyId: 3 })
    expect(audits).toEqual(['api-token.issued'])
  })

  it('narrows to the requested scope, caps the lifetime, and refuses a scope the key lacks', async () => {
    const { rt } = runtime()
    const ok = await read(await handleTokenExchange(post({ scope: 'pages:read', expires_in: 999999 }), rt))
    expect(ok).toMatchObject({ scope: 'pages:read', expires_in: 3600 })
    const bad = await handleTokenExchange(post({ scope: 'orders:write' }), rt)
    expect(bad.status).toBe(400)
    expect((await read(bad)).error).toBe('invalid_scope')
  })

  it('refuses no credential, an access token, a refused key, a limited key and the wrong method', async () => {
    const { rt } = runtime()
    expect((await handleTokenExchange(new Request('https://site.test/x', { method: 'POST' }), rt)).status).toBe(401)
    const { token } = await signAccessToken(rt.keys, { issuer: 'i', userId: 7, keyId: 3, scopes: ['pages:read'], seconds: 60, now: NOW })
    expect((await handleTokenExchange(post({}, `Bearer ${token}`), rt)).status).toBe(401)
    expect((await handleTokenExchange(post({}), runtime({ refuse: 401 }).rt)).status).toBe(401)
    expect((await handleTokenExchange(post({}), runtime({ refuse: 503 }).rt)).status).toBe(503)
    const limited = await handleTokenExchange(post({}), runtime({ limited: true }).rt)
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBe('9')
    expect((await handleTokenExchange(new Request('https://site.test/x', { method: 'GET' }), rt)).status).toBe(405)
  })

  it('creates and verifies a one-time token, once, for staff keys only', async () => {
    const { rt, audits } = runtime()
    const made = await handleOneTimeCreate(post({ purpose: 'handoff', payload: { cart: 4 }, expires_in: 120 }), rt)
    expect(made.status).toBe(201)
    const created = await read(made)
    expect(created.purpose).toBe('handoff')
    const good = await handleOneTimeVerify(post({ token: created.token, purpose: 'handoff' }), rt)
    expect(good.status).toBe(200)
    expect(await good.json()).toMatchObject({ valid: true, subject: 7, payload: { cart: 4 } })
    expect((await handleOneTimeVerify(post({ token: created.token, purpose: 'handoff' }), rt)).status).toBe(404)
    expect(audits).toEqual(['one-time-token.issued', 'one-time-token.used'])

    const customer = runtime({ roles: ['customer'] })
    expect((await handleOneTimeCreate(post({ purpose: 'handoff' }), customer.rt)).status).toBe(403)
    expect((await handleOneTimeVerify(post({ token: 'egot_x', purpose: 'handoff' }), customer.rt)).status).toBe(403)
    expect((await handleOneTimeCreate(post({ purpose: 'Bad Purpose' }), rt)).status).toBe(400)
  })

  it('keeps API purposes apart from site purposes', async () => {
    const { rt } = runtime()
    const store = rt.oneTime
    const internal = await issueOneTimeToken(store, { purpose: 'handoff', userId: 7, now: NOW })
    if (!internal.ok) throw new Error('expected ok')
    expect((await handleOneTimeVerify(post({ token: internal.token, purpose: 'handoff' }), rt)).status).toBe(404)
  })
})
