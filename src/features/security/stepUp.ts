/**
 * Step-up confirmation: before an administrator is added (an account gains the admin role), the
 * person making the change proves it is them again with their password or an authenticator code.
 *
 * The proof is a short-lived signed cookie, issued by the "Confirm it's you" screen
 * (/admin/security/confirm) after the password or code checks out. It names the user and an expiry,
 * and is signed with ENGAGE_SECRET. Pure and edge-safe: Web Crypto only, no database, no request.
 *
 * Changing your own password already needs the current password (profile.ts), and turning two-step
 * off or regenerating backup codes already needs a password or code (twoFactor.ts), so those are
 * not repeated here. A first admin (nobody is an admin yet) and internal calls with no signed-in
 * user are not asked: there is nobody to ask.
 */

export const STEP_UP_COOKIE = 'engage-stepup'
export const STEP_UP_MAX_AGE_S = 600

const encoder = new TextEncoder()

const toHex = (buffer: ArrayBuffer): string => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(`stepup:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)))
}

const safeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** The cookie value for `userId`, good for STEP_UP_MAX_AGE_S seconds from `now`. */
export async function issueStepUp(userId: number, secret: string, now: number = Date.now()): Promise<string> {
  const payload = `${userId}.${now + STEP_UP_MAX_AGE_S * 1000}`
  return `${payload}.${await sign(payload, secret)}`
}

/** True when `value` was issued for `userId`, is signed with `secret`, and has not expired. */
export async function hasValidStepUp(value: string | null | undefined, userId: number, secret: string, now: number = Date.now()): Promise<boolean> {
  if (!value || !secret) return false
  const [id, exp, mac] = value.split('.')
  if (!id || !exp || !mac || Number(id) !== userId) return false
  const expiry = Number(exp)
  if (!Number.isFinite(expiry) || expiry <= now) return false
  return safeEqual(mac, await sign(`${id}.${exp}`, secret))
}

export const readCookie = (header: string | null | undefined, name: string): string | null => {
  for (const part of (header ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return rest.join('=') || null
  }
  return null
}

/** True when this write gives somebody the admin role they did not have. */
export function grantsAdmin(previousRoles: unknown, nextRoles: unknown): boolean {
  if (!Array.isArray(nextRoles) || !nextRoles.includes('admin')) return false
  return !(Array.isArray(previousRoles) && previousRoles.includes('admin'))
}

export const STEP_UP_MESSAGE = 'Confirm it is you before adding an administrator: open Security > Confirm it is you (/admin/security/confirm), enter your password or a code, then save again.'
