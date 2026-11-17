/**
 * A plain text question as the accessible alternative to the CAPTCHA widget (Task 19a). For visitors who cannot use the
 * widget (screen reader, keyboard only, blocked script): "What is 7 plus 4?" typed into a normal field. The answer is
 * never sent to the browser; the question comes with a signed token (HMAC-SHA-256 with ENGAGE_SECRET) that holds the
 * answer and an expiry. No secret on the site means no fallback is offered.
 */

export const FALLBACK_ANSWER_FIELD = 'captcha-answer'
export const FALLBACK_TOKEN_FIELD = 'captcha-token'
export const FALLBACK_LIFETIME_MS = 15 * 60_000

export type FallbackQuestion = { question: string; token: string }

const encoder = new TextEncoder()
const b64 = (bytes: ArrayBuffer): string => {
  let s = ''
  for (const byte of new Uint8Array(bytes)) s += String.fromCharCode(byte)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(`${secret}:captcha-fallback`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)))
}

const secretOf = (): string => (typeof process !== 'undefined' ? process.env.ENGAGE_SECRET || '' : '')

/** A fresh question, or null when the site has no secret to sign with. */
export async function makeFallback(now = Date.now(), secret = secretOf(), random: () => number = Math.random): Promise<FallbackQuestion | null> {
  if (!secret) return null
  const a = 2 + Math.floor(random() * 8)
  const b = 2 + Math.floor(random() * 8)
  const expires = now + FALLBACK_LIFETIME_MS
  const payload = `${expires}.${a + b}`
  return { question: `What is ${a} plus ${b}? Type the number.`, token: `${expires}.${await sign(secret, payload)}` }
}

/** True when the typed answer matches a question that was issued by this site and has not expired. */
export async function checkFallback(token: unknown, answer: unknown, now = Date.now(), secret = secretOf()): Promise<boolean> {
  if (!secret || typeof token !== 'string' || typeof answer !== 'string') return false
  const [expiresText, signature] = token.split('.')
  const expires = Number(expiresText)
  const typed = Number.parseInt(answer.trim(), 10)
  if (!Number.isFinite(expires) || expires < now || !signature || !Number.isFinite(typed) || typed < 4 || typed > 18) return false
  return (await sign(secret, `${expires}.${typed}`)) === signature
}
