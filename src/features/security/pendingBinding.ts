/**
 * The browser half of the pending two-step token binding (23a1).
 *
 * The first sign-in step hands the browser a random value in this cookie; only its hash goes into
 * the pending token. The second step must send the cookie back, so a token copied out of a log or
 * off a shared screen cannot be finished from another browser.
 */

export const PENDING_BINDING_COOKIE = 'eg_pending_bind'
/** A little longer than the pending token's 5 minutes; the token is what actually expires. */
export const PENDING_BINDING_MAX_AGE_S = 600

/** Reads the binding value out of a raw `Cookie:` header. */
export function pendingBindingFromCookieHeader(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === PENDING_BINDING_COOKIE) return rest.join('=') || null
  }
  return null
}

/** The Set-Cookie line for route handlers: HttpOnly, lax, whole site. */
export function buildPendingBindingCookie(nonce: string, secure = process.env.NODE_ENV === 'production'): string {
  return `${PENDING_BINDING_COOKIE}=${nonce}; Max-Age=${PENDING_BINDING_MAX_AGE_S}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`
}

export function buildClearedPendingBindingCookie(secure = process.env.NODE_ENV === 'production'): string {
  return `${PENDING_BINDING_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`
}
