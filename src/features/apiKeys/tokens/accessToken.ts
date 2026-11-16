import { b64urlDecode, b64urlEncode } from '@/features/socialLogin/util'

import { isAccessTokenShape } from '../core'
import { currentSigningKey, publishedKeys, type SigningKeyStore } from './signingKeys'

/**
 * Short-lived signed API access tokens (RFC 9068 shape): ES256, header typ
 * `at+jwt`, claims iss, sub (the key owner), aud `engage-api`, iat, exp, jti,
 * scope (space separated) and `key` (the id of the API key it was exchanged for).
 *
 * A token is only ever a view of an API key: every request re-checks that the
 * key is still live and its owner allowed (see `authenticateApiKey`), so
 * revoking a key stops its tokens at once. Verification accepts ES256 only.
 */

export { isAccessTokenShape }
export const ACCESS_TOKEN_TYPE = 'at+jwt'
export const ACCESS_TOKEN_AUDIENCE = 'engage-api'
export const DEFAULT_TOKEN_SECONDS = 900
export const MIN_TOKEN_SECONDS = 60
export const MAX_TOKEN_SECONDS = 3600
const CLOCK_SKEW_S = 30

const encoder = new TextEncoder()
const parseJson = (bytes: Uint8Array): Record<string, unknown> | null => {
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes))
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export const clampTokenSeconds = (value: unknown): number => {
  const n = value === undefined || value === null || value === '' ? DEFAULT_TOKEN_SECONDS : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_TOKEN_SECONDS
  return Math.min(MAX_TOKEN_SECONDS, Math.max(MIN_TOKEN_SECONDS, Math.floor(n)))
}

export type AccessTokenInput = { issuer: string; userId: number; keyId: number; scopes: readonly string[]; seconds: number; now: number }

export async function signAccessToken(store: SigningKeyStore, input: AccessTokenInput): Promise<{ token: string; expiresAt: number }> {
  const key = await currentSigningKey(store, input.now)
  const iat = Math.floor(input.now / 1000)
  const exp = iat + input.seconds
  const header = b64urlEncode(JSON.stringify({ alg: 'ES256', typ: ACCESS_TOKEN_TYPE, kid: key.kid }))
  const payload = b64urlEncode(
    JSON.stringify({
      iss: input.issuer,
      sub: String(input.userId),
      aud: ACCESS_TOKEN_AUDIENCE,
      iat,
      exp,
      jti: b64urlEncode(crypto.getRandomValues(new Uint8Array(12))),
      scope: input.scopes.join(' '),
      key: input.keyId,
    }),
  )
  const privateKey = await crypto.subtle.importKey('jwk', key.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, encoder.encode(`${header}.${payload}`)))
  return { token: `${header}.${payload}.${b64urlEncode(signature)}`, expiresAt: exp * 1000 }
}

export type VerifiedAccessToken = { userId: number; keyId: number; scopes: string[]; jti: string; expiresAt: number }

/** Returns the verified claims, or null for anything wrong (bad signature, expired, wrong audience, unknown key id). */
export async function verifyAccessToken(store: SigningKeyStore, token: string, now: number): Promise<VerifiedAccessToken | null> {
  const parts = token.split('.')
  if (parts.length !== 3 || parts.some((p) => !p) || token.length > 4096) return null
  let header: Record<string, unknown> | null
  let claims: Record<string, unknown> | null
  try {
    header = parseJson(b64urlDecode(parts[0]))
    claims = parseJson(b64urlDecode(parts[1]))
  } catch {
    return null
  }
  if (!header || !claims || header.alg !== 'ES256' || header.typ !== ACCESS_TOKEN_TYPE || typeof header.kid !== 'string') return null

  const jwk = (await publishedKeys(store, now)).find((k) => k.kid === header.kid)
  if (!jwk) return null
  let valid = false
  try {
    const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b64urlDecode(parts[2]), encoder.encode(`${parts[0]}.${parts[1]}`))
  } catch {
    valid = false
  }
  if (!valid) return null

  const nowS = Math.floor(now / 1000)
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_S < nowS) return null
  if (typeof claims.iat !== 'number' || claims.iat - CLOCK_SKEW_S > nowS) return null
  if (claims.aud !== ACCESS_TOKEN_AUDIENCE) return null
  const userId = Number(claims.sub)
  const keyId = Number(claims.key)
  if (!Number.isInteger(userId) || !Number.isInteger(keyId) || typeof claims.scope !== 'string' || typeof claims.jti !== 'string') return null
  return { userId, keyId, scopes: claims.scope.split(' ').filter(Boolean), jti: claims.jti, expiresAt: claims.exp * 1000 }
}
