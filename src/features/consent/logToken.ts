/**
 * The banner token for POST /api/consent-log.
 *
 * The banner carries a token: an HMAC of the policy version and the week it was
 * issued in, keyed with ENGAGE_SECRET (or a fixed fallback key when that secret is
 * not set). The log accepts the current and the previous week, so a page cached
 * for a few days still logs, and a stranger who posts to the endpoint without
 * loading the banner is refused. It stops blind inflation of the log; it is not a
 * secret, because anyone who loads the page can read the banner.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const TOKEN_LENGTH = 32
const FALLBACK_KEY = 'consent-log-without-engage-secret'
const encoder = new TextEncoder()

const keyMaterial = (): string => process.env.ENGAGE_SECRET || FALLBACK_KEY

/** The week a token is issued in. */
export const tokenWeek = (now: number = Date.now()): number => Math.floor(now / WEEK_MS)

async function tokenFor(policyVersion: number, week: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(keyMaterial()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`consent-log:${policyVersion}:${week}`))
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, TOKEN_LENGTH)
}

/** The token the banner sends with each consent record. */
export function consentLogToken(policyVersion: number, now: number = Date.now()): Promise<string> {
  return tokenFor(policyVersion, tokenWeek(now))
}

/** True when `token` was issued for this policy version this week or last week. */
export async function isValidConsentLogToken(token: unknown, policyVersion: number, now: number = Date.now()): Promise<boolean> {
  if (typeof token !== 'string' || token.length !== TOKEN_LENGTH || !/^[0-9a-f]+$/.test(token)) return false
  const week = tokenWeek(now)
  for (const candidate of [week, week - 1]) {
    if (token === (await tokenFor(policyVersion, candidate))) return true
  }
  return false
}
