import crypto from 'crypto'

/**
 * The second cookie behind the account switcher (23h).
 *
 * The normal session cookie stays the active account. The other accounts this browser has signed
 * in to are parked here as their session tokens and nothing else: a signed value, at most
 * `MAX_OTHER_ACCOUNTS` entries. Pure functions only; the cookie writing and the token checks live
 * in `switcher.ts`.
 */

export const OTHER_SESSIONS_COOKIE = 'eg_other_sessions'
export const MAX_OTHER_ACCOUNTS = 4

const sign = (payload: string, secret: string): string => crypto.createHmac('sha256', secret).update(payload).digest('base64url')

/** Packs the tokens into a signed cookie value. Empty when there is nothing to keep or no secret to sign with. */
export function packOtherSessions(tokens: string[], secret: string): string {
  const clean = unique(tokens.filter((t) => typeof t === 'string' && t.length > 0)).slice(0, MAX_OTHER_ACCOUNTS)
  if (!secret || clean.length === 0) return ''
  const payload = Buffer.from(JSON.stringify(clean)).toString('base64url')
  return `${payload}.${sign(payload, secret)}`
}

/** The tokens in a cookie value, or an empty list when it is missing, altered or signed with another secret. */
export function unpackOtherSessions(value: string | null | undefined, secret: string): string[] {
  if (!value || !secret) return []
  const dot = value.lastIndexOf('.')
  if (dot < 1) return []
  const payload = value.slice(0, dot)
  const given = Buffer.from(value.slice(dot + 1))
  const expected = Buffer.from(sign(payload, secret))
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return []
  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!Array.isArray(parsed)) return []
    return unique(parsed.filter((t): t is string => typeof t === 'string' && t.length > 0)).slice(0, MAX_OTHER_ACCOUNTS)
  } catch {
    return []
  }
}

/** Adds a token to the kept list. Newest first; the oldest entry falls off past the cap. */
export const withToken = (tokens: string[], token: string): string[] => unique([token, ...tokens]).slice(0, MAX_OTHER_ACCOUNTS)

export const withoutToken = (tokens: string[], token: string): string[] => tokens.filter((t) => t !== token)

function unique(list: string[]): string[] {
  return Array.from(new Set(list))
}
