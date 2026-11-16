import { intersectScopes } from '../categories'
import { isStaffRoles, KEY_PREFIX, normalizeScope, presentedApiKey, type HeadersLike } from '../core'
import type { ApiKeyContext } from '../service'
import { clampTokenSeconds, signAccessToken } from './accessToken'
import { API_PURPOSE_PREFIX, consumeOneTimeToken, issueOneTimeToken, normalisePurpose, type OneTimeStore } from './oneTime'
import type { SigningKeyStore } from './signingKeys'

/**
 * The three token endpoints as plain functions of a Request and a runtime, so
 * the tests drive them with fakes and the route files stay one line each.
 *
 *   POST /api/auth/token                    API key in, short-lived access token out
 *   POST /api/auth/one-time-token           make a one-time token (staff keys)
 *   POST /api/auth/one-time-token/verify    use one up (staff keys)
 */

export type TokenCaller = { key: ApiKeyContext; owner: { id: number; email: string; roles: string[] } }

export type TokenAudit = {
  action: 'api-token.issued' | 'one-time-token.issued' | 'one-time-token.used'
  actorId: number
  actorEmail: string
  detail: string
}

export type TokenRuntime = {
  now(): number
  origin(request: Request): string
  /** Checks the presented key the way every API request does. Throws `ApiKeyRefused` when it is not usable. */
  authenticate(headers: Headers): Promise<TokenCaller>
  keys: SigningKeyStore
  oneTime: OneTimeStore
  limit(bucket: string, perMinute: number): { limited: boolean; retryAfterSeconds: number }
  audit(entry: TokenAudit): Promise<void>
}

const NO_STORE = { 'Cache-Control': 'no-store', Pragma: 'no-cache' }

const fail = (status: number, error: string, description: string, extra: Record<string, string> = {}): Response =>
  Response.json({ error, error_description: description }, { status, headers: { ...NO_STORE, ...extra } })

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get('content-type') || ''
  try {
    if (type.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(await request.text()))
    const data: unknown = await request.json()
    return data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

async function authenticated(rt: TokenRuntime, request: Request, opts: { keyOnly: boolean; staffOnly: boolean }): Promise<TokenCaller | Response> {
  const presented = presentedApiKey(request.headers as HeadersLike)
  if (!presented) return fail(401, 'invalid_client', 'Send an API key as "Authorization: Bearer egk_...".', { 'WWW-Authenticate': 'Bearer' })
  // Only a real key may be exchanged. A token cannot mint another token, or it would never stop.
  if (opts.keyOnly && !presented.startsWith(KEY_PREFIX)) return fail(401, 'invalid_client', 'Exchange needs an API key, not an access token.', { 'WWW-Authenticate': 'Bearer' })
  let caller: TokenCaller
  try {
    caller = await rt.authenticate(request.headers)
  } catch (error) {
    const status = (error as { status?: number }).status === 503 ? 503 : 401
    return fail(status, status === 503 ? 'temporarily_unavailable' : 'invalid_client', status === 503 ? 'The key could not be checked. Try again.' : 'API key is not valid.', status === 401 ? { 'WWW-Authenticate': 'Bearer' } : {})
  }
  const limit = rt.limit(`api-token:${caller.key.id}`, 60)
  if (limit.limited) return fail(429, 'slow_down', 'Too many requests for this key.', { 'Retry-After': String(limit.retryAfterSeconds) })
  if (opts.staffOnly && !isStaffRoles(caller.owner.roles)) return fail(403, 'access_denied', 'One-time tokens need a key that belongs to a staff account.')
  return caller
}

const methodNotAllowed = (): Response => fail(405, 'invalid_request', 'Use POST.', { Allow: 'POST' })

export async function handleTokenExchange(request: Request, rt: TokenRuntime): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed()
  const caller = await authenticated(rt, request, { keyOnly: true, staffOnly: false })
  if (caller instanceof Response) return caller
  const body = await readBody(request)

  let scopes = caller.key.scopes
  if (body.scope !== undefined && body.scope !== null && body.scope !== '') {
    const asked = String(body.scope).split(/[\s,]+/).filter(Boolean)
    if (asked.length === 0 || asked.length > 50 || asked.some((s) => !normalizeScope(s))) return fail(400, 'invalid_scope', 'Use collection:action scopes (for example pages:read), separated by spaces.')
    scopes = intersectScopes(caller.key.scopes, asked)
    if (scopes.length === 0) return fail(400, 'invalid_scope', 'The key does not hold any of the requested scopes.')
  }
  const seconds = clampTokenSeconds(body.expires_in)
  const { token } = await signAccessToken(rt.keys, { issuer: rt.origin(request), userId: caller.owner.id, keyId: caller.key.id, scopes, seconds, now: rt.now() })
  await rt.audit({ action: 'api-token.issued', actorId: caller.owner.id, actorEmail: caller.owner.email, detail: `key ${caller.key.id}, ${seconds}s` }).catch((): void => undefined)
  return Response.json({ access_token: token, token_type: 'Bearer', expires_in: seconds, scope: scopes.join(' ') }, { headers: NO_STORE })
}

const prefixed = (bare: unknown): string | null => {
  const purpose = normalisePurpose(bare)
  return purpose ? normalisePurpose(`${API_PURPOSE_PREFIX}${purpose}`) : null
}

export async function handleOneTimeCreate(request: Request, rt: TokenRuntime): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed()
  const caller = await authenticated(rt, request, { keyOnly: false, staffOnly: true })
  if (caller instanceof Response) return caller
  const body = await readBody(request)
  const purpose = prefixed(body.purpose)
  if (!purpose) return fail(400, 'invalid_request', 'The purpose must be up to 35 characters: letters, numbers, colon, dash or underscore.')
  const result = await issueOneTimeToken(rt.oneTime, { purpose, userId: caller.owner.id, payload: body.payload, seconds: body.expires_in, now: rt.now() })
  if (result.ok === false) return fail(400, 'invalid_request', result.error)
  await rt.audit({ action: 'one-time-token.issued', actorId: caller.owner.id, actorEmail: caller.owner.email, detail: `${purpose}, key ${caller.key.id}` }).catch((): void => undefined)
  return Response.json({ token: result.token, purpose: purpose.slice(API_PURPOSE_PREFIX.length), expires_at: result.expiresAt }, { status: 201, headers: NO_STORE })
}

export async function handleOneTimeVerify(request: Request, rt: TokenRuntime): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed()
  const caller = await authenticated(rt, request, { keyOnly: false, staffOnly: true })
  if (caller instanceof Response) return caller
  const body = await readBody(request)
  const purpose = prefixed(body.purpose)
  if (!purpose) return fail(400, 'invalid_request', 'Send the purpose the token was made for.')
  const used = await consumeOneTimeToken(rt.oneTime, body.token, purpose, rt.now())
  if (!used) return Response.json({ valid: false }, { status: 404, headers: NO_STORE })
  await rt.audit({ action: 'one-time-token.used', actorId: caller.owner.id, actorEmail: caller.owner.email, detail: `${purpose}, key ${caller.key.id}` }).catch((): void => undefined)
  return Response.json(
    { valid: true, purpose: used.purpose.slice(API_PURPOSE_PREFIX.length), subject: used.userId, payload: used.payload, issued_at: used.issuedAt },
    { headers: NO_STORE },
  )
}
