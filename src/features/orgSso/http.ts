import { resolveEndpoints, EndpointError } from '@/features/socialLogin/endpoints'
import { buildAuthorizeUrl, exchangeForIdentity, FlowError } from '@/features/socialLogin/flow'
import type { SocialRuntime } from '@/features/socialLogin/http'
import { emptyProviderConfig, type ProviderConfig } from '@/features/socialLogin/providers'
import { newFlowSecrets, openState, sealState, STATE_MAX_AGE_MS, type FlowState } from '@/features/socialLogin/state'

import { connectionForEmail, discoveryUrlFor, type SsoConnection } from './core'
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
}

const NO_STORE = 'no-store'
const serialize = (name: string, value: string, maxAge: number, secure: boolean, path = '/'): string =>
  `${name}=${value}; Path=${path}; Max-Age=${maxAge}; SameSite=Lax; HttpOnly${secure ? '; Secure' : ''}`

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

  const outcome = await completeSso(rt.deps, conn, { subject: identity.providerUserId, email: identity.email, emailVerified: identity.emailVerified })
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
