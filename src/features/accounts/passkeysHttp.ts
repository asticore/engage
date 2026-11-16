import { refuseWhileImpersonating } from '@/features/impersonation/policy'
import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'

import {
  PASSKEY_CHALLENGE_COOKIE,
  PASSKEY_REFUSED_MESSAGE,
  listPasskeys,
  loginOptions,
  loginWithPasskey,
  secondStepAvailable,
  secondStepOptions,
  verifySecondStep,
  registerPasskey,
  registrationOptions,
  removePasskey,
  renamePasskey,
} from '@/features/passkeys'
import { methodAllowed, readMatrix } from '@/features/security/authMatrix'

import { guardAttempt, tooManyAttempts } from './rateLimit'
import { passkeyDepsFor } from './passkeysWiring'
import { accountContext, requestAddress, requestClient, clearPendingBindingCookie, setPendingBindingCookie, setSessionCookie, setTrustedDeviceCookie } from './session'
import { signInWithCode } from './auth'
import { recordAuthEvent } from '@/features/security/authAudit'
import { safeLandingPath } from '@/features/passwordless'

/**
 * JSON handlers for passkeys. The identity of a registration, a removal or a
 * listing always comes from the session cookie (accountContext), never from the
 * body. A sign-in names no account: the credential id in the answer finds it.
 * Every route refuses cross-site requests and answers no-store.
 */

const noStore = { 'Cache-Control': 'no-store' }
const json = (body: Record<string, unknown>, status = 200): Response => NextResponse.json(body, { status, headers: noStore })

const sameSite = async (request: Request): Promise<boolean> => {
  const origin = (await headers()).get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === new URL(request.url).host
  } catch {
    return false
  }
}

const readJson = async (request: Request): Promise<Record<string, unknown>> => {
  try {
    const data = (await request.json()) as unknown
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

const setChallengeCookie = async (value: string): Promise<void> => {
  const jar = await cookies()
  jar.set(PASSKEY_CHALLENGE_COOKIE, value, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/passkeys',
    maxAge: 300,
  })
}

const clearChallengeCookie = async (): Promise<void> => {
  const jar = await cookies()
  jar.delete({ name: PASSKEY_CHALLENGE_COOKIE, path: '/api/passkeys' })
}

const challengeFromRequest = async (): Promise<string | null> => (await cookies()).get(PASSKEY_CHALLENGE_COOKIE)?.value ?? null

const UNAVAILABLE = 'Passkeys are not available on this site.'
const SIGNED_OUT = 'Sign in first.'

/** POST /api/passkeys/register-options: creation options for the signed-in person. */
export async function registerOptionsResponse(request: Request): Promise<Response> {  const blocked = refuseWhileImpersonating(await headers())
  if (blocked) return json({ ok: false, message: blocked }, 403)

  if (!(await sameSite(request))) return json({ ok: false, message: UNAVAILABLE }, 403)
  const context = await accountContext()
  if (!context.flags.accounts || !context.user) return json({ ok: false, message: SIGNED_OUT }, 401)
  const deps = await passkeyDepsFor(context.engine, await requestClient(), request.url)
  const outcome = await registrationOptions(deps, context.user as never)
  if (!outcome.ok) return json({ ok: false, message: outcome.message }, outcome.status)
  await setChallengeCookie(outcome.cookie ?? '')
  return json({ ok: true, options: outcome.options })
}

/** POST /api/passkeys/register-verify: checks the new credential. Body carries the answer and a password or code. */
export async function registerVerifyResponse(request: Request): Promise<Response> {  const blocked = refuseWhileImpersonating(await headers())
  if (blocked) return json({ ok: false, message: blocked }, 403)

  if (!(await sameSite(request))) return json({ ok: false, message: UNAVAILABLE }, 403)
  const context = await accountContext()
  if (!context.flags.accounts || !context.user) return json({ ok: false, message: SIGNED_OUT }, 401)
  const userId = Number((context.user as { id: number }).id)
  const limited = await guardAttempt(context.engine, 'passkey', `user:${userId}`)
  if (!limited.allowed) return json({ ok: false, message: tooManyAttempts(limited.retryAfterSeconds ?? 60) }, 429)
  const body = await readJson(request)
  const deps = await passkeyDepsFor(context.engine, await requestClient(), request.url)
  const outcome = await registerPasskey(deps, context.user as never, body as never, await challengeFromRequest())
  await clearChallengeCookie()
  if (!outcome.ok) return json({ ok: false, message: outcome.message }, outcome.status)
  return json({ ok: true, id: outcome.id, passkeys: await listPasskeys(deps, Number((context.user as { id: number }).id)) })
}

/** POST /api/passkeys/login-options: discoverable sign-in options. Refused when passkeys are off. */
export async function loginOptionsResponse(request: Request): Promise<Response> {
  if (!(await sameSite(request))) return json({ ok: false, message: UNAVAILABLE }, 403)
  const context = await accountContext()
  if (!context.flags.accounts) return json({ ok: false, message: UNAVAILABLE }, 404)
  { const m = await readMatrix(); if (!methodAllowed(m, 'account', 'passkeys') && !methodAllowed(m, 'admin', 'passkeys')) return json({ ok: false, message: UNAVAILABLE }, 403) }
  const byIp = await guardAttempt(context.engine, 'passkey', `ip:${await requestAddress()}`)
  if (!byIp.allowed) return json({ ok: false, message: tooManyAttempts(byIp.retryAfterSeconds ?? 60) }, 429)
  const deps = await passkeyDepsFor(context.engine, await requestClient(), request.url)
  const outcome = await loginOptions(deps)
  if (!outcome.ok) return json({ ok: false, message: outcome.message }, outcome.status)
  await setChallengeCookie(outcome.cookie ?? '')
  return json({ ok: true, options: outcome.options })
}

/** POST /api/passkeys/login-verify: signs the person in, or hands back a pending token for the two-step code. */
export async function loginVerifyResponse(request: Request): Promise<Response> {
  if (!(await sameSite(request))) return json({ ok: false, message: UNAVAILABLE }, 403)
  const context = await accountContext()
  if (!context.flags.accounts) return json({ ok: false, message: UNAVAILABLE }, 404)
  { const m = await readMatrix(); if (!methodAllowed(m, 'account', 'passkeys') && !methodAllowed(m, 'admin', 'passkeys')) return json({ ok: false, message: UNAVAILABLE }, 403) }
  const byIp = await guardAttempt(context.engine, 'passkey', `ip:${await requestAddress()}`)
  if (!byIp.allowed) return json({ ok: false, message: tooManyAttempts(byIp.retryAfterSeconds ?? 60) }, 429)
  const body = await readJson(request)
  const deps = await passkeyDepsFor(context.engine, await requestClient(), request.url)
  const outcome = await loginWithPasskey(deps, body as never, await challengeFromRequest())
  await clearChallengeCookie()
  if (outcome.status === 'refused') return json({ ok: false, message: outcome.message }, 400)
  if (outcome.status === 'two-factor') await setPendingBindingCookie(outcome.pendingBinding)
  if (outcome.status === 'two-factor') return json({ ok: false, twoFactorRequired: true, pendingToken: outcome.pendingToken }, 200)
  await setSessionCookie(outcome.token)
  const next = typeof body.next === 'string' ? body.next : ''
  const adminArea = body.area === 'admin'
  const redirect = adminArea ? (next.startsWith('/admin') && !next.startsWith('//') && !next.includes('\\') ? next : '/admin') : safeLandingPath(next)
  return json({ ok: true, redirect })
}

/** GET /api/passkeys/list: the signed-in person's passkeys, without key material. */
export async function listResponse(request: Request): Promise<Response> {
  const context = await accountContext()
  if (!context.user) return json({ ok: false, message: SIGNED_OUT }, 401)
  const deps = await passkeyDepsFor(context.engine, await requestClient(), request.url)
  return json({ ok: true, enabled: deps.settings.enabled, passkeys: await listPasskeys(deps, Number((context.user as { id: number }).id)) })
}

/** POST /api/passkeys/rename: body { id, label }. The id must belong to the signed-in person. */
export async function renameResponse(request: Request): Promise<Response> {  const blocked = refuseWhileImpersonating(await headers())
  if (blocked) return json({ ok: false, message: blocked }, 403)

  if (!(await sameSite(request))) return json({ ok: false, message: UNAVAILABLE }, 403)
  const context = await accountContext()
  if (!context.user) return json({ ok: false, message: SIGNED_OUT }, 401)
  const body = await readJson(request)
  const deps = await passkeyDepsFor(context.engine, await requestClient(), request.url)
  const result = await renamePasskey(deps, Number((context.user as { id: number }).id), Number(body.id), body.label)
  return json(result, result.ok ? 200 : 400)
}

/** POST /api/passkeys/remove: body { id, password? , code? }. Re-authentication and the last-method rule apply. */
export async function removeResponse(request: Request): Promise<Response> {  const blocked = refuseWhileImpersonating(await headers())
  if (blocked) return json({ ok: false, message: blocked }, 403)

  if (!(await sameSite(request))) return json({ ok: false, message: UNAVAILABLE }, 403)
  const context = await accountContext()
  if (!context.user) return json({ ok: false, message: SIGNED_OUT }, 401)
  const userId = Number((context.user as { id: number }).id)
  const limited = await guardAttempt(context.engine, 'passkey', `user:${userId}`)
  if (!limited.allowed) return json({ ok: false, message: tooManyAttempts(limited.retryAfterSeconds ?? 60) }, 429)
  const body = await readJson(request)
  const deps = await passkeyDepsFor(context.engine, await requestClient(), request.url)
  const result = await removePasskey(deps, userId, Number(body.id), {
    password: typeof body.password === 'string' ? body.password : undefined,
    code: typeof body.code === 'string' ? body.code : undefined,
  })
  return json({ ok: result.ok, message: result.message }, result.ok ? 200 : (result.status ?? 400))
}

/** GET /api/passkeys/availability?area=account|admin: whether the sign-in screen should show the passkey button. */
export async function availabilityResponse(request: Request): Promise<Response> {
  const context = await accountContext()
  if (!context.flags.accounts) return json({ enabled: false })
  const area = new URL(request.url).searchParams.get('area') === 'admin' ? 'admin' : 'account'
  const deps = await passkeyDepsFor(context.engine, await requestClient(), request.url)
  const allowed = deps.settings.enabled && (area === 'account' || deps.settings.allowAdmins) && deps.secret.length > 0
  return json({ enabled: allowed })
}


const pendingTokenOf = (body: Record<string, unknown>): string => (typeof body.pendingToken === 'string' ? body.pendingToken : '')

/**
 * POST /api/passkeys/second-options: body { pendingToken, probe? }. For the second sign-in step.
 * The account comes from the pending token. With `probe` it only says whether a passkey can be used;
 * otherwise it returns a challenge limited to that account's passkeys.
 */
export async function secondOptionsResponse(request: Request): Promise<Response> {
  if (!(await sameSite(request))) return json({ ok: false, message: UNAVAILABLE }, 403)
  const context = await accountContext()
  if (!context.flags.accounts) return json({ ok: false, message: UNAVAILABLE }, 404)
  const byIp = await guardAttempt(context.engine, 'passkey', `ip:${await requestAddress()}`)
  if (!byIp.allowed) return json({ ok: false, message: tooManyAttempts(byIp.retryAfterSeconds ?? 60) }, 429)
  const body = await readJson(request)
  const userId = await context.engine.pendingTokenUser({ pendingToken: pendingTokenOf(body), client: await requestClient() }).catch((): null => null)
  if (userId === null) return json({ ok: false, available: false, message: UNAVAILABLE }, 400)
  const deps = await passkeyDepsFor(context.engine, await requestClient(), request.url)
  const area = body.area === 'admin' ? 'admin' : 'account'
  const m = await readMatrix()
  const methodOk = methodAllowed(m, area, 'passkeys')
  if (body.probe === true) return json({ ok: true, available: methodOk && (await secondStepAvailable(deps, userId)) })
  if (!methodOk) return json({ ok: false, message: UNAVAILABLE }, 403)
  const outcome = await secondStepOptions(deps, userId)
  if (!outcome.ok) return json({ ok: false, message: outcome.message }, outcome.status)
  await setChallengeCookie(outcome.cookie ?? '')
  return json({ ok: true, options: outcome.options })
}

/**
 * POST /api/passkeys/second-verify: body { pendingToken, trustDevice?, next?, area?, id, rawId, response }.
 * Checks the assertion against the pending token's account, then finishes the sign-in through the same
 * second-step path a code uses. A failed answer counts toward the lockout; the pending token is spent on success.
 */
export async function secondVerifyResponse(request: Request): Promise<Response> {
  if (!(await sameSite(request))) return json({ ok: false, message: UNAVAILABLE }, 403)
  const context = await accountContext()
  if (!context.flags.accounts) return json({ ok: false, message: UNAVAILABLE }, 404)
  const byIp = await guardAttempt(context.engine, 'two-factor', await requestAddress())
  if (!byIp.allowed) return json({ ok: false, message: tooManyAttempts(byIp.retryAfterSeconds ?? 60) }, 429)
  const body = await readJson(request)
  const pendingToken = pendingTokenOf(body)
  const userId = await context.engine.pendingTokenUser({ pendingToken, client: await requestClient() }).catch((): null => null)
  if (userId === null) return json({ ok: false, message: PASSKEY_REFUSED_MESSAGE }, 400)
  const area = body.area === 'admin' ? 'admin' : 'account'
  if (!methodAllowed(await readMatrix(), area, 'passkeys')) return json({ ok: false, message: UNAVAILABLE }, 403)

  const origin = await requestClient()
  const deps = await passkeyDepsFor(context.engine, origin, request.url)
  const outcome = await verifySecondStep(deps, userId, body as never, await challengeFromRequest())
  await clearChallengeCookie()
  // A refused answer is a failed second step: it counts toward the same lockout as a wrong code.
  const result = await signInWithCode(context.engine, pendingToken, '', origin, {
    method: 'passkey',
    trustDevice: body.trustDevice === true,
    passkeyVerifiedUserId: outcome.status === 'ok' ? userId : undefined,
  })
  if (outcome.status === 'refused' || !result.ok || !result.token) {
    await recordAuthEvent(context.engine, { action: result.reason === 'locked' ? 'login.locked' : 'two-factor.failed', detail: 'passkey step' }, origin)
    return json({ ok: false, message: outcome.status === 'refused' ? outcome.message : PASSKEY_REFUSED_MESSAGE }, 400)
  }
  await recordAuthEvent(context.engine, { action: 'two-factor.verified', actorId: result.userId ?? null, detail: 'passkey' }, origin)
  await recordAuthEvent(context.engine, { action: 'login.success', actorId: result.userId ?? null, detail: 'two-step passkey' }, origin)
  await setSessionCookie(result.token)
  if (result.trustedDevice) await setTrustedDeviceCookie(result.trustedDevice.token, result.trustedDevice.maxAgeSeconds)
  ;(await cookies()).delete('eg_social_pending')
  await clearPendingBindingCookie()
  const next = typeof body.next === 'string' ? body.next : ''
  const redirect = area === 'admin' ? (next.startsWith('/admin') && !next.startsWith('//') && !next.includes('\\') ? next : '/admin') : safeLandingPath(next)
  return json({ ok: true, redirect })
}
