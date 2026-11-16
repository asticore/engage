import type { AuditAction } from '@/features/security/auditLog'

import { EndpointError, resolveEndpoints, type Endpoints } from './endpoints'
import { buildAuthorizeUrl, exchangeForIdentity, FlowError, identityFromClaims, type Identity } from './flow'
import { TokenError, verifyIdToken, type Fetcher } from './jwt'
import { isExtraProviderId, isProviderId, isUsable, hasCredentials, PROVIDERS, redirectUriFor, usesIdToken, type ProviderId, type SocialConfig } from './providers'
import { resolveLink, resolveSignIn, isCustomerOnly, type PolicyDeps, type Outcome } from './service'
import { usableProviders } from './settings'
import {
  newFlowSecrets,
  openState,
  sealState,
  STATE_COOKIE,
  STATE_MAX_AGE_MS,
  type FlowArea,
  type FlowMode,
  type FlowState,
} from './state'

/**
 * The three endpoints behind the social buttons, as plain functions of a
 * `Request` and a `SocialRuntime`. The route files only build the runtime and
 * call these; the tests call them with fakes - fake provider, fake fetch, fake
 * stores - so the whole flow is exercised without a network.
 */

export const PENDING_COOKIE = 'eg_social_pending'
export const PENDING_MAX_AGE_S = 300

export type SessionUser = { id: number; email: string; roles: string[] }

export type SocialRuntime = {
  secret: string
  fetchImpl: Fetcher
  now(): number
  origin(request: Request): string
  readConfig(): Promise<SocialConfig>
  policy(config: SocialConfig): PolicyDeps
  /** The user the request's session cookie belongs to, or null. */
  sessionUser(request: Request): Promise<SessionUser | null>
  /** Session or pending second-factor token for an identity already proven. Throws when the account is locked or gone. */
  login(userId: number, request: Request): Promise<{ token?: string; pendingToken?: string }>
  audit(action: AuditAction, request: Request, entry: { actorId?: number | null; actorEmail?: string | null; detail: string }): Promise<void>
  limited(request: Request): Promise<boolean>
  sessionCookie: { name: string; maxAgeSeconds: number }
}

type CookieOpts = { maxAge?: number; secure: boolean; httpOnly?: boolean; path?: string }

const serialize = (name: string, value: string, o: CookieOpts): string =>
  `${name}=${value}; Path=${o.path ?? '/'}; Max-Age=${o.maxAge ?? 0}; SameSite=Lax${o.httpOnly === false ? '' : '; HttpOnly'}${o.secure ? '; Secure' : ''}`

const NO_STORE = 'no-store'

function redirect(origin: string, path: string, cookies: string[] = []): Response {
  const headers = new Headers({ Location: `${origin}${path}`, 'Cache-Control': NO_STORE })
  for (const c of cookies) headers.append('Set-Cookie', c)
  return new Response(null, { status: 303, headers })
}

const readCookie = (request: Request, name: string): string | null => {
  const header = request.headers.get('cookie') || ''
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim()
  }
  return null
}

export const safeNext = (value: string | null, area: FlowArea, mode: FlowMode): string => {
  const prefix = area === 'admin' ? '/admin' : '/account'
  const fallback = mode === 'link' ? (area === 'admin' ? '/admin/security/social' : '/account/profile') : prefix
  if (!value || !value.startsWith(prefix) || value.startsWith('//') || value.includes('\\') || value.length > 300) return fallback
  return value
}

const isAdminUser = (user: SessionUser | null): boolean => Boolean(user && user.roles.includes('admin'))

/** Where an admin test sign-in reports back: the Security settings page, or the page for the providers set up separately. */
const testPath = (id: ProviderId, outcome: 'ok' | 'fail', detail: string): string =>
  isExtraProviderId(id)
    ? `/admin/security/sign-in-providers?social_test=${id}:${outcome}:${detail}#provider-${id}`
    : `/admin/settings/security?social_test=${id}:${outcome}:${detail}#social-login`

/** Where a failure is shown, per flow. */
function failurePath(state: Pick<FlowState, 'mode' | 'area' | 'p'>, code: string): string {
  const q = `social_error=${encodeURIComponent(code)}`
  if (state.mode === 'test') return testPath(state.p, 'fail', encodeURIComponent(code))
  if (state.mode === 'link') return state.area === 'admin' ? `/admin/security/social?${q}` : `/account/profile?${q}#connected`
  return state.area === 'admin' ? `/admin/login?${q}` : `/account/sign-in?${q}`
}

const clearState = (secure: boolean): string => serialize(STATE_COOKIE, '', { maxAge: 0, secure, path: '/api/social' })

const flowMode = (value: string | null): FlowMode => (value === 'link' || value === 'test' ? value : 'signin')
const flowArea = (value: string | null): FlowArea => (value === 'admin' ? 'admin' : 'account')

const notFound = (): Response => new Response('Not found', { status: 404, headers: { 'Cache-Control': NO_STORE } })

// --- GET /api/social/providers ----------------------------------------------

export async function handleProviders(request: Request, rt: SocialRuntime): Promise<Response> {
  const area = flowArea(new URL(request.url).searchParams.get('area'))
  const config = await rt.readConfig()
  return Response.json({ providers: usableProviders(config, area) }, { headers: { 'Cache-Control': NO_STORE } })
}

// --- GET /api/social/[provider]/start ---------------------------------------

export async function handleStart(request: Request, providerParam: string, rt: SocialRuntime): Promise<Response> {
  if (!isProviderId(providerParam)) return notFound()
  const id: ProviderId = providerParam
  const url = new URL(request.url)
  const mode = flowMode(url.searchParams.get('mode'))
  const area = flowArea(url.searchParams.get('area'))
  const origin = rt.origin(request)
  const secure = origin.startsWith('https://')
  const config = await rt.readConfig()
  const cfg = config.providers[id]

  const user = mode === 'signin' ? null : await rt.sessionUser(request)
  const stateStub = { mode, area, p: id }

  if (mode === 'test') {
    // Admin-only, and allowed before the switch is on so the owner can check the setup first.
    if (!isAdminUser(user)) return redirect(origin, '/admin/login')
    if (!hasCredentials(id, cfg)) return redirect(origin, failurePath(stateStub, 'unavailable'))
  } else {
    // Disabled is a 404, as if the provider did not exist.
    if (!cfg.enabled) return notFound()
    if (!hasCredentials(id, cfg)) return redirect(origin, failurePath(stateStub, 'unavailable'))
    if (mode === 'link' && !user) return redirect(origin, area === 'admin' ? '/admin/login' : '/account/sign-in')
    if (area === 'admin' && !config.allowAdminSocialLogin) return notFound()
    if ((config.blocked?.[area] ?? []).includes(id)) return notFound()
  }

  if (await rt.limited(request)) return redirect(origin, failurePath(stateStub, 'rate-limited'))
  if (!rt.secret) return redirect(origin, failurePath(stateStub, 'unavailable'))

  const def = PROVIDERS[id]
  let endpoints: Endpoints
  try {
    endpoints = await resolveEndpoints(id, cfg, rt.fetchImpl, rt.now())
  } catch (error) {
    return redirect(origin, failurePath(stateStub, error instanceof EndpointError ? error.reason : 'provider'))
  }
  const secrets = newFlowSecrets()
  const state: FlowState = {
    p: id,
    s: secrets.s,
    v: def.pkce ? secrets.v : '',
    n: usesIdToken(id, cfg) ? secrets.n : '',
    mode,
    area,
    next: safeNext(url.searchParams.get('next'), area, mode),
    uid: user ? String(user.id) : '',
    iat: rt.now(),
  }

  const location = await buildAuthorizeUrl(id, cfg, {
    redirectUri: redirectUriFor(origin, id),
    state: state.s,
    nonce: state.n,
    verifier: state.v,
    endpoints,
  })
  const headers = new Headers({ Location: location, 'Cache-Control': NO_STORE })
  headers.append(
    'Set-Cookie',
    serialize(STATE_COOKIE, await sealState(rt.secret, state), {
      maxAge: Math.floor(STATE_MAX_AGE_MS / 1000),
      secure,
      path: '/api/social',
    }),
  )
  return new Response(null, { status: 303, headers })
}

// --- GET|POST /api/social/[provider]/callback -------------------------------

export async function handleCallback(request: Request, providerParam: string, rt: SocialRuntime): Promise<Response> {
  if (!isProviderId(providerParam)) return notFound()
  const id: ProviderId = providerParam
  const origin = rt.origin(request)
  const secure = origin.startsWith('https://')
  const config = await rt.readConfig()

  const url = new URL(request.url)
  const params = url.searchParams

  if (request.method === 'POST') {
    // Apple answers with a cross-site form POST, where a SameSite=Lax cookie is not sent. Bounce to a GET so it is.
    const form = await request.formData().catch((): null => null)
    const forward = new URLSearchParams()
    for (const key of ['code', 'state', 'error']) {
      const v = form?.get(key)
      if (typeof v === 'string' && v.length < 4000) forward.set(key, v)
    }
    return redirect(origin, `/api/social/${id}/callback?${forward.toString()}`)
  }

  const cookieValue = readCookie(request, STATE_COOKIE)
  const state = await openState(rt.secret, cookieValue ? decodeURIComponent(cookieValue) : null, params.get('state'), id, rt.now())
  const clear = [clearState(secure)]
  if (!state) {
    // No trustworthy state: we do not even know which flow this was.
    return redirect(origin, `/account/sign-in?social_error=state`, clear)
  }

  const fail = async (code: string, detail?: string): Promise<Response> => {
    if (state.mode === 'signin') {
      await rt.audit('social.refused', request, { detail: `${id}: ${detail ?? code}` })
    }
    return redirect(origin, failurePath(state, code), clear)
  }

  const cfg = config.providers[id]
  if (state.mode === 'test' ? !hasCredentials(id, cfg) : !isUsable(id, cfg)) return fail('unavailable')
  if (state.area === 'admin' && state.mode !== 'test' && !config.allowAdminSocialLogin) return fail('admin-disabled')

  const session = state.mode === 'signin' ? null : await rt.sessionUser(request)
  if (state.mode === 'test' && !isAdminUser(session)) return redirect(origin, '/admin/login', clear)
  if (state.mode === 'link' && (!session || String(session.id) !== state.uid)) return redirect(origin, '/account/sign-in', clear)

  if (params.get('error')) return fail('denied', `provider said ${params.get('error')!.slice(0, 40)}`)
  const code = params.get('code') ?? ''
  if (!code || code.length > 4000) return fail('denied')

  if (await rt.limited(request)) return fail('rate-limited')

  let identity: Identity
  try {
    const endpoints = await resolveEndpoints(id, cfg, rt.fetchImpl, rt.now())
    identity = await exchangeForIdentity(id, cfg, {
      endpoints,
      code,
      redirectUri: redirectUriFor(origin, id),
      verifier: state.v,
      nonce: state.n,
      fetchImpl: rt.fetchImpl,
      now: rt.now(),
    })
  } catch (error) {
    const reason = error instanceof FlowError || error instanceof EndpointError ? error.reason : 'unknown'
    if (state.mode === 'test') return redirect(origin, failurePath(state, reason), clear)
    return fail('provider', reason)
  }

  // Test: prove the setup works. Touches no account, creates no link, signs nobody in.
  if (state.mode === 'test') {
    const note = !identity.email ? 'no-email' : identity.emailVerified ? 'email-verified' : 'email-unverified'
    return redirect(origin, testPath(id, 'ok', note), clear)
  }

  const deps = rt.policy(config)

  if (state.mode === 'link') {
    const outcome = await resolveLink(deps, session!.id, identity)
    if (!outcome.ok) {
      await rt.audit('social.refused', request, { actorId: session!.id, actorEmail: session!.email, detail: `${id}: link ${outcome.code}` })
      return redirect(origin, failurePath(state, outcome.code), clear)
    }
    if (outcome.linked) {
      await rt.audit('social.linked', request, { actorId: session!.id, actorEmail: session!.email, detail: `${id} connected` })
    }
    const sep = state.next.includes('?') ? '&' : '?'
    return redirect(origin, `${state.next}${sep}social=linked`, clear)
  }

  const done = await finishSignIn(rt, request, deps, identity, { id, area: state.area, next: state.next, secure })
  if (done.ok === false) return fail(done.code, done.detail)
  return redirect(origin, done.to, [...clear, ...done.cookies])
}

type SignInDone = { ok: true; to: string; cookies: string[] } | { ok: false; code: string; detail?: string }

/**
 * Turns a proven identity into a session (or a pending second step): resolves the account by the
 * rules in service.ts, logs in, and says where to go and which cookies to set. Shared by the
 * redirect flow and Google One Tap, so both obey exactly the same policy.
 */
async function finishSignIn(
  rt: SocialRuntime,
  request: Request,
  deps: PolicyDeps,
  identity: Identity,
  ctx: { id: ProviderId; area: FlowArea; next: string; secure: boolean },
): Promise<SignInDone> {
  const { id, area, next, secure } = ctx
  const outcome: Outcome = await resolveSignIn(deps, identity, { allowCreate: area === 'account' })
  if (!outcome.ok) return { ok: false, code: outcome.code }

  let result: { token?: string; pendingToken?: string }
  try {
    result = await rt.login(outcome.userId, request)
  } catch {
    return { ok: false, code: 'locked', detail: 'login refused' }
  }

  if (outcome.linked) {
    await rt.audit('social.linked', request, { actorId: outcome.userId, detail: `${id} connected${outcome.created ? ' (new account)' : ' (matched verified email)'}` })
  }

  const user = await deps.findUserByID(outcome.userId)
  const staff = Boolean(user && !isCustomerOnly(user.roles))
  const target = area === 'admin' && !staff ? '/account' : next

  if (result.pendingToken) {
    // Social sign-in never skips two-step. The code step finishes it.
    await rt.audit('social.login', request, { actorId: outcome.userId, detail: `${id}: password-equivalent step done, awaiting two-step code` })
    const pendingCookie = serialize(PENDING_COOKIE, result.pendingToken, { maxAge: PENDING_MAX_AGE_S, secure, path: '/' })
    const to = staff || area === 'admin' ? '/admin/login?social=2fa' : `/account/sign-in?social=2fa&next=${encodeURIComponent(target)}`
    return { ok: true, to, cookies: [pendingCookie] }
  }
  if (!result.token) return { ok: false, code: 'locked', detail: 'no token' }

  await rt.audit('social.login', request, { actorId: outcome.userId, detail: `${id}: signed in` })
  const sessionCookie = serialize(rt.sessionCookie.name, result.token, { maxAge: rt.sessionCookie.maxAgeSeconds, secure, path: '/' })
  return { ok: true, to: target, cookies: [sessionCookie] }
}

// --- GET|POST /api/social/one-tap ------------------------------------

const GOOGLE_JWKS = 'https://www.googleapis.com/oauth2/v3/certs'
const jsonNoStore = (body: Record<string, unknown>, status = 200, cookies: string[] = []): Response => {
  const headers = new Headers({ 'Cache-Control': NO_STORE })
  for (const c of cookies) headers.append('Set-Cookie', c)
  return Response.json(body, { status, headers })
}

/** One Tap is offered only when switched on and Google itself is fully set up for member sign-in. */
const oneTapAvailable = (config: SocialConfig): boolean => config.googleOneTap && isUsable('google', config.providers.google)

/**
 * GET: hands the browser what Google's prompt needs (the public client ID and a fresh nonce) and
 * remembers the nonce and a random `state` in the signed state cookie, so the credential Google
 * returns can only be used by this browser, once, within ten minutes.
 */
export async function handleOneTapStart(request: Request, rt: SocialRuntime): Promise<Response> {
  const config = await rt.readConfig()
  if (!oneTapAvailable(config) || !rt.secret) return notFound()
  if (await rt.limited(request)) return jsonNoStore({ ok: false, code: 'rate-limited' }, 429)
  const origin = rt.origin(request)
  const secure = origin.startsWith('https://')
  const secrets = newFlowSecrets()
  const next = safeNext(new URL(request.url).searchParams.get('next'), 'account', 'signin')
  const state: FlowState = { p: 'google', s: secrets.s, v: '', n: secrets.n, mode: 'signin', area: 'account', next, uid: '', iat: rt.now() }
  const cookie = serialize(STATE_COOKIE, await sealState(rt.secret, state), { maxAge: Math.floor(STATE_MAX_AGE_MS / 1000), secure, path: '/api/social' })
  return jsonNoStore({ ok: true, clientId: config.providers.google.clientId, nonce: secrets.n, state: secrets.s }, 200, [cookie])
}

/** POST { credential, state }: checks Google's signed ID token and signs the person in under the usual rules. */
export async function handleOneTapSignIn(request: Request, rt: SocialRuntime): Promise<Response> {
  const config = await rt.readConfig()
  if (!oneTapAvailable(config)) return notFound()
  const origin = rt.origin(request)
  const secure = origin.startsWith('https://')
  // A cross-site page must not be able to post a credential: the request has to come from this site.
  const from = request.headers.get('origin')
  if (!from || from !== origin) return jsonNoStore({ ok: false, code: 'state' }, 403)

  const body = (await request.json().catch((): null => null)) as { credential?: unknown; state?: unknown } | null
  const credential = typeof body?.credential === 'string' ? body.credential : ''
  const stateParam = typeof body?.state === 'string' ? body.state : ''
  const clear = [clearState(secure)]
  const cookieValue = readCookie(request, STATE_COOKIE)
  const state = await openState(rt.secret, cookieValue ? decodeURIComponent(cookieValue) : null, stateParam, 'google', rt.now())
  if (!state || state.mode !== 'signin' || state.area !== 'account' || !credential || credential.length > 4000) return jsonNoStore({ ok: false, code: 'state' }, 400, clear)
  if (await rt.limited(request)) return jsonNoStore({ ok: false, code: 'rate-limited' }, 429, clear)

  const cfg = config.providers.google
  let identity: Identity
  try {
    const claims = await verifyIdToken(credential, {
      jwksUrl: GOOGLE_JWKS,
      audience: cfg.clientId,
      nonce: state.n,
      issuerOk: (iss) => iss === 'https://accounts.google.com' || iss === 'accounts.google.com',
      fetchImpl: rt.fetchImpl,
      now: rt.now(),
    })
    identity = identityFromClaims('google', claims)
  } catch (error) {
    const reason = error instanceof TokenError ? `token-${error.reason}` : 'token'
    await rt.audit('social.refused', request, { detail: `google one-tap: ${reason}` })
    return jsonNoStore({ ok: false, code: 'provider' }, 400, clear)
  }

  const done = await finishSignIn(rt, request, rt.policy(config), identity, { id: 'google', area: 'account', next: state.next, secure })
  if (done.ok === false) {
    await rt.audit('social.refused', request, { detail: `google one-tap: ${done.detail ?? done.code}` })
    return jsonNoStore({ ok: false, code: done.code }, 400, clear)
  }
  return jsonNoStore({ ok: true, redirect: done.to }, 200, [...clear, ...done.cookies])
}

// --- GET /api/social/pending ------------------------------------------------

/**
 * Hands the admin login screen the second-factor pending token that the
 * callback parked in an HttpOnly cookie, and clears it. The token alone gets
 * nobody in - it still needs a code - and it lives five minutes.
 */
export async function handlePending(request: Request, rt: SocialRuntime): Promise<Response> {
  const secure = rt.origin(request).startsWith('https://')
  const token = readCookie(request, PENDING_COOKIE)
  const headers = new Headers({ 'Cache-Control': NO_STORE })
  headers.append('Set-Cookie', serialize(PENDING_COOKIE, '', { maxAge: 0, secure, path: '/' }))
  return Response.json({ pendingToken: token || null }, { headers })
}
