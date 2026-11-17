/**
 * Admin bypass for the IP and country lists (Task 19d). An admin turns it on from Settings > Security > IP lists; the
 * browser then carries a signed cookie (HMAC-SHA-256 with ENGAGE_SECRET, 30 days) that the middleware accepts, so a
 * signed-in admin is never locked out by a range or country rule. Without ENGAGE_SECRET it never validates.
 */
export const BYPASS_COOKIE = 'eg_ip_bypass'
export const BYPASS_SECONDS = 30 * 24 * 3600

const hex = (buf: ArrayBuffer): string => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

async function mac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(`${secret}:ip-bypass`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)))
}

export async function signBypass(secret: string, userId: string | number, nowMs = Date.now()): Promise<string | null> {
  if (!secret) return null
  const payload = `${userId}.${Math.floor(nowMs / 1000) + BYPASS_SECONDS}`
  return `${payload}.${await mac(secret, payload)}`
}

export async function verifyBypass(token: string | undefined, secret: string, nowMs = Date.now()): Promise<boolean> {
  if (!token || !secret) return false
  const at = token.lastIndexOf('.')
  if (at < 1) return false
  const payload = token.slice(0, at)
  const exp = Number(payload.split('.')[1])
  if (!Number.isFinite(exp) || exp * 1000 < nowMs) return false
  const expected = await mac(secret, payload)
  const given = token.slice(at + 1)
  if (expected.length !== given.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i)
  return diff === 0
}
