import { cookies } from 'next/headers'
import type { Engine } from '@/engine'

import { SESSION_COOKIE } from '@/features/security'
import { sessionIdFromToken } from '@/features/security/userSessions'
import { loginProtectionAuth } from '@/features/security'

import { MAX_OTHER_ACCOUNTS, OTHER_SESSIONS_COOKIE, packOtherSessions, unpackOtherSessions, withToken, withoutToken } from './otherSessions'

/**
 * The account switcher's server half (23h).
 *
 * Every entry is re-validated by the engine's own session check each time it is read, so a token
 * that was revoked, expired or whose account was deleted simply disappears from the list. The
 * switcher only ever shows an email address. Admin sessions are never parked (one admin session at
 * a time), and a parked token is only ever one this browser already held.
 */

export type OtherAccount = { id: string; email: string; token: string }

const secretValue = (): string => process.env.ENGAGE_SECRET || ''

const isAdmin = (roles: unknown): boolean => Array.isArray(roles) && roles.includes('admin')

/** Who a token belongs to, or null when the engine does not accept it any more. */
export async function whoOwnsToken(engine: Engine, token: string): Promise<{ userId: string; email: string; roles: unknown } | null> {
  try {
    const { user } = await engine.auth({ headers: new Headers({ cookie: `${SESSION_COOKIE}=${token}` }) })
    const u = user as unknown as { id?: number | string; email?: string; roles?: unknown } | null
    if (!u || u.id === undefined || u.id === null) return null
    return { userId: String(u.id), email: String(u.email ?? ''), roles: u.roles }
  } catch {
    return null
  }
}

export async function readStoredTokens(): Promise<string[]> {
  const jar = await cookies()
  return unpackOtherSessions(jar.get(OTHER_SESSIONS_COOKIE)?.value, secretValue())
}

/** The still-valid parked accounts, one per person, never the one currently signed in. */
export async function listOtherAccounts(engine: Engine, activeUserId: string | null): Promise<OtherAccount[]> {
  const tokens = await readStoredTokens()
  const seen = new Set<string>(activeUserId ? [activeUserId] : [])
  const out: OtherAccount[] = []
  for (const token of tokens) {
    const owner = await whoOwnsToken(engine, token)
    if (!owner || isAdmin(owner.roles) || seen.has(owner.userId)) continue
    const id = sessionIdFromToken(token)
    if (!id) continue
    seen.add(owner.userId)
    out.push({ id, email: owner.email, token })
  }
  return out
}

export async function writeStoredTokens(tokens: string[]): Promise<void> {
  const jar = await cookies()
  const value = packOtherSessions(tokens, secretValue())
  if (!value) {
    jar.delete(OTHER_SESSIONS_COOKIE)
    return
  }
  jar.set(OTHER_SESSIONS_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: loginProtectionAuth().tokenExpiration,
  })
}

/** Whether another account can be parked: not an admin, and the cookie can be signed. */
export const canPark = (roles: unknown): boolean => Boolean(secretValue()) && !isAdmin(roles)

export type SwitchResult = { ok: true } | { ok: false; message: string }

/**
 * Makes a parked account the active one. The target is re-checked by the engine first; the account
 * being left is parked in its place (unless it is an admin), and the target leaves the parked list.
 */
export async function switchTo(engine: Engine, currentToken: string | null, targetId: string): Promise<SwitchResult & { token?: string }> {
  const stored = await readStoredTokens()
  const target = stored.find((t) => sessionIdFromToken(t) === targetId)
  if (!target) return { ok: false, message: 'That account is no longer signed in here.' }

  const owner = await whoOwnsToken(engine, target)
  if (!owner || isAdmin(owner.roles)) {
    await writeStoredTokens(withoutToken(stored, target))
    return { ok: false, message: 'That account was signed out. Sign in to it again.' }
  }

  let next = withoutToken(stored, target)
  if (currentToken && currentToken !== target) {
    const current = await whoOwnsToken(engine, currentToken)
    if (current && !isAdmin(current.roles) && current.userId !== owner.userId) next = withToken(next, currentToken)
  }
  await writeStoredTokens(next.slice(0, MAX_OTHER_ACCOUNTS))
  return { ok: true, token: target }
}

/** Adds a token to the parked list (the caller has already checked it is not an admin's). */
export async function withTokenParked(token: string): Promise<void> {
  await writeStoredTokens(withToken(await readStoredTokens(), token))
}
