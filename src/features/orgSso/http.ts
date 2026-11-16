import { resolveEndpoints, EndpointError } from '@/features/socialLogin/endpoints'
import { buildAuthorizeUrl, exchangeForIdentity, FlowError } from '@/features/socialLogin/flow'
import type { SocialRuntime } from '@/features/socialLogin/http'
import { emptyProviderConfig, type ProviderConfig } from '@/features/socialLogin/providers'
import { newFlowSecrets, openState, sealState, STATE_MAX_AGE_MS, type FlowState } from '@/features/socialLogin/state'

import { connectionForEmail, discoveryUrlFor, type SsoConnection } from './core'
import { buildAuthnRequest, deflateBase64, newRequestId, spMetadata, validateSamlResponse } from './saml'
import { completeSso, type SsoDeps } from './service'

/**
 * The two public endpoints behind "Sign in with single sign-on", as functions of a Request and a runtime, so the
 * tests run the whole flow with a fake identity provider. Reuses the generic OpenID Connect flow from Task 23d
 * (discovery, PKCE, nonce, signature and issuer checks) with one connection's settings.
 */

export const SSO_STATE_COOKIE = 'eg_sso_state'
const PATH = '/api/sso'

export type SsoRuntime = Pick<SocialRuntime, 'secret' | 'fetchImpl' | 'now' | 'origin' | 'login' | 'audit' | 'limited' | 'sessionCookie'> & {
  listConnections(): Promise<SsoConnection[]>
  getConnection(id: string): Promise<SsoConnection | null>
  deps: SsoDeps
  /** One-time use of a SAML assertion id. False means it was already used. */
  markAssertionSeen(assertionId: string, expiresAt: number, now: number): Promise<boolean>
}

const NO_STORE = 'no-store'
const serialize = (name: string, value: string, maxAge: number, secure: boolean, path = '/', sameSite: 'Lax' | 'None' = 'Lax'): string =>
  `${name}=${value}; Path=${path}; Max-Age=${maxAge}; SameSite=${sameSite}; HttpOnly${secure || sameSite === 'None' ? '; Secure' : ''}`

const redirect = (origin: string, path: string, cookies: string[] = []): Response => {
  const headers = new Headers({ Location: `${origin}${path}`, 'Cache-Control': NO_STORE })
  for (const c of cookies) headers.append('Set-Cookie', c)
  return new Response(null, { status: 303, headers })
}

const readCookie = (request: Request, name: string): string | null => {
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim()
  }
  return null
}

export const configFor = (conn: SsoConnection): ProviderConfig => ({
  ...emptyProviderConfig(),
  enabled: true,
  clientId: conn.clientId,
  clientSecret: conn.clientSecret,
  discoveryUrl: discoveryUrlFor(conn.issuer),
  // The organisation vouches for its own provider, and the address must still be on a verified domain.
  trustEmail: true,
})

const redirectUri = (origin: string): string => `${origin}${PATH}/callback`
const fail = (origin: string, code: string, cookies: string[] = []): Response => redirect(origin, `/account/sign-in?sso_error=${encodeURIComponent(code)}`, cookies)

const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

const formPage = (message: string): Response =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Single sign-on</title></head><body style="font-family:system-ui;max-width:28rem;margin:4rem auto;padding:0 1rem"><h1>Single sign-on</h1>${message ? `<p role="alert">${escapeHtml(message)}</p>` : ''}<form method="get" action="${PATH}/start"><label for="email">Work email</label><br><input id="email" name="email" type="email" required autocomplete="email" style="width:100%;padding:.5rem;margin:.5rem 0"><br><button type="submit" style="padding:.5rem 1rem">Continue</button></form></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': NO_STORE } },
  )

/** GET /api/sso/start?email=: with no email, a small form; with one, sends the person to their organisation's provider. */
export async function handleSsoStart(request: Request, rt: SsoRuntime): Promise<Response> {
  const url = new URL(request.url)
  const email = (url.searchParams.get('email') ?? '').trim().toLowerCase().slice(0, 254)
  const origin = rt.origin(request)
  const secure = origin.startsWith('https://')
  if (!email) return formPage(url.searchParams.get('error') ? 'Single sign-on is not available for that address.' : '')
  if (!rt.secret) return formPage('Single sign-on is not available right now.')
  if (await rt.limited(request)) return formPage('Too many attempts. Wait a few minutes and try again.')

  const conn = connectionForEmail(await rt.listConnections(), email)
  // The same answer whether or not the domain is known, so the form cannot be used to list organisations.
  if (!conn) return redirect(origin, `${PATH}/start?error=1`)
  if (conn.saml) return samlStart(request, rt, conn, email, origin)
  let endpoints
  try {
    endpoints = await resolveEndpoints('oidc', configFor(conn), rt.fetchImpl, rt.now())
  } catch (error) {
    return redirect(origin, `${PATH}/start?error=1${error instanceof EndpointError ? '' : ''}`)
  }
  const secrets = newFlowSecrets()
  const state: FlowState = { p: 'oidc', s: secrets.s, v: secrets.v, n: secrets.n, mode: 'signin', area: 'account', next: '/account', uid: conn.id, iat: rt.now() }
  const location = await buildAuthorizeUrl('oidc', configFor(conn), { redirectUri: redirectUri(origin), state: state.s, nonce: state.n, verifier: state.v, endpoints })
  const withHint = `${location}${location.includes('?') ? '&' : '?'}login_hint=${encodeURIComponent(email)}`
  const headers = new Headers({ Location: withHint, 'Cache-Control': NO_STORE })
  headers.append('Set-Cookie', serialize(SSO_STATE_COOKIE, await sealState(rt.secret, state), Math.floor(STATE_MAX_AGE_MS / 1000), secure, PATH))
  return new Response(null, { status: 303, headers })
}

/** GET /api/sso/callback: finishes the sign-in under the rules in service.ts. */
export async function handleSsoCallback(request: Request, rt: SsoRuntime): Promise<Response> {
  const origin = rt.origin(request)
  const secure = origin.startsWith('https://')
  const params = new URL(request.url).searchParams
  const clear = serialize(SSO_STATE_COOKIE, '', 0, secure, PATH)
  const cookieValue = readCookie(request, SSO_STATE_COOKIE)
  const state = await openState(rt.secret, cookieValue ? decodeURIComponent(cookieValue) : null, params.get('state'), 'oidc', rt.now())
  if (!state || !state.uid) return fail(origin, 'state', [clear])

  const refuse = async (code: string, detail: string): Promise<Response> => {
    await rt.audit('social.refused', request, { detail: `sso: ${detail}` })
    return fail(origin, code, [clear])
  }
  const conn = await rt.getConnection(state.uid)
  if (!conn || !conn.enabled) return refuse('unavailable', 'connection off or gone')
  if (params.get('error')) return refuse('denied', `provider said ${params.get('error')!.slice(0, 40)}`)
  const code = params.get('code') ?? ''
  if (!code || code.length > 4000) return refuse('denied', 'no code')
  if (await rt.limited(request)) return refuse('rate-limited', 'rate limited')

  let identity
  try {
    const cfg = configFor(conn)
    const endpoints = await resolveEndpoints('oidc', cfg, rt.fetchImpl, rt.now())
    identity = await exchangeForIdentity('oidc', cfg, { endpoints, code, redirectUri: redirectUri(origin), verifier: state.v, nonce: state.n, fetchImpl: rt.fetchImpl, now: rt.now() })
  } catch (error) {
    return refuse('provider', error instanceof FlowError || error instanceof EndpointError ? error.reason : 'unknown')
  }

  return finishSso(rt, request, conn, { subject: identity.providerUserId, email: identity.email, emailVerified: identity.emailVerified }, clear, secure, origin, refuse)
}

/** Shared by the OpenID Connect and SAML callbacks: applies the account rules, then signs the person in. */
async function finishSso(
  rt: SsoRuntime,
  request: Request,
  conn: SsoConnection,
  identity: { subject: string; email: string | null; emailVerified: boolean },
  clear: string,
  secure: boolean,
  origin: string,
  refuse: (code: string, detail: string) => Promise<Response>,
): Promise<Response> {
  const outcome = await completeSso(rt.deps, conn, identity)
  if (!outcome.ok) return refuse(outcome.code ?? 'refused', `${conn.name}: ${outcome.code}`)

  let result: { token?: string; pendingToken?: string }
  try {
    result = await rt.login(outcome.userId!, request)
  } catch {
    return refuse('locked', 'login refused')
  }
  if (result.pendingToken) {
    // Single sign-on never skips two-step when the person has it; the code step finishes it.
    await rt.audit('social.login', request, { actorId: outcome.userId, detail: `sso ${conn.name}: awaiting two-step code` })
    return redirect(origin, '/account/sign-in?social=2fa&next=%2Faccount', [clear, serialize('eg_social_pending', result.pendingToken, 300, secure)])
  }
  if (!result.token) return refuse('locked', 'no token')
  await rt.audit('social.login', request, { actorId: outcome.userId, detail: `sso ${conn.name}: signed in${outcome.created ? ' (new account)' : ''}` })
  return redirect(origin, '/account', [clear, serialize(rt.sessionCookie.name, result.token, rt.sessionCookie.maxAgeSeconds, secure)])
}

// --- SAML 2.0 -----------------------------------------------------------------

export const spEntityIdFor = (origin: string, connId: string): string => `${origin}${PATH}/saml/metadata/${connId}`
export const acsUrlFor = (origin: string): string => `${origin}${PATH}/saml/acs`

async function samlStart(request: Request, rt: SsoRuntime, conn: SsoConnection, email: string, origin: string): Promise<Response> {
  const saml = conn.saml!
  const secure = origin.startsWith('https://')
  const secrets = newFlowSecrets()
  const requestId = newRequestId()
  // `n` carries the request id, so only a response to this very request is accepted.
  const state: FlowState = { p: 'oidc', s: secrets.s, v: '', n: requestId, mode: 'signin', area: 'account', next: '/account', uid: conn.id, iat: rt.now() }
  const xml = buildAuthnRequest({ id: requestId, now: rt.now(), destination: saml.ssoUrl, acsUrl: acsUrlFor(origin), spEntityId: spEntityIdFor(origin, conn.id) })
  const url = new URL(saml.ssoUrl)
  url.searchParams.set('SAMLRequest', await deflateBase64(xml))
  url.searchParams.set('RelayState', state.s)
  const headers = new Headers({ Location: url.toString(), 'Cache-Control': NO_STORE })
  // The identity provider answers with a cross-site POST, where a Lax cookie is not sent; so this one is SameSite=None.
  headers.append('Set-Cookie', serialize(SSO_STATE_COOKIE, await sealState(rt.secret, state), Math.floor(STATE_MAX_AGE_MS / 1000), true, PATH, 'None'))
  void email
  void secure
  return new Response(null, { status: 303, headers })
}

/** GET /api/sso/saml/metadata/:id: the service provider metadata to hand to the identity provider. */
export async function handleSamlMetadata(request: Request, connId: string, rt: SsoRuntime): Promise<Response> {
  const conn = await rt.getConnection(connId)
  if (!conn || !conn.saml) return new Response('Not found', { status: 404 })
  const origin = rt.origin(request)
  return new Response(spMetadata({ spEntityId: spEntityIdFor(origin, conn.id), acsUrl: acsUrlFor(origin) }), { headers: { 'Content-Type': 'application/samlmetadata+xml; charset=utf-8', 'Cache-Control': 'no-store' } })
}

/** POST /api/sso/saml/acs: the identity provider's answer. */
export async function handleSamlAcs(request: Request, rt: SsoRuntime): Promise<Response> {
  const origin = rt.origin(request)
  const clear = serialize(SSO_STATE_COOKIE, '', 0, true, PATH, 'None')
  const form = await request.formData().catch((): null => null)
  const response = form?.get('SAMLResponse')
  const relay = form?.get('RelayState')
  const cookieValue = readCookie(request, SSO_STATE_COOKIE)
  const state = await openState(rt.secret, cookieValue ? decodeURIComponent(cookieValue) : null, typeof relay === 'string' ? relay : null, 'oidc', rt.now())
  if (!state || !state.uid || !state.n.startsWith('_')) return fail(origin, 'state', [clear])
  const refuse = async (code: string, detail: string): Promise<Response> => {
    await rt.audit('social.refused', request, { detail: `sso saml: ${detail}` })
    return fail(origin, code, [clear])
  }
  const conn = await rt.getConnection(state.uid)
  if (!conn || !conn.enabled || !conn.saml) return refuse('unavailable', 'connection off or gone')
  if (typeof response !== 'string' || response.length > 300_000) return refuse('denied', 'no response')
  if (await rt.limited(request)) return refuse('rate-limited', 'rate limited')

  let xml = ''
  try {
    xml = new TextDecoder().decode(Uint8Array.from(atob(response), (c) => c.charCodeAt(0)))
  } catch {
    return refuse('provider', 'not base64')
  }
  const result = validateSamlResponse({
    xml,
    keys: conn.saml.keys,
    idpEntityId: conn.saml.entityId,
    spEntityId: spEntityIdFor(origin, conn.id),
    acsUrl: acsUrlFor(origin),
    requestId: state.n,
    now: rt.now(),
    emailAttribute: conn.saml.emailAttribute,
  })
  if (result.ok === false) return refuse('provider', `${conn.name}: ${result.code}`)
  if (!(await rt.markAssertionSeen(result.assertion.assertionId, result.assertion.notOnOrAfter, rt.now()))) return refuse('provider', `${conn.name}: replay`)
  return finishSso(rt, request, conn, { subject: result.assertion.subject, email: result.assertion.email, emailVerified: true }, clear, origin.startsWith('https://'), origin, refuse)
}
