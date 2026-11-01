/**
 * One-click unsubscribe for reminder and marketing mail (see `bulk` in types.ts).
 *
 * A token names one address and carries an HMAC made with ENGAGE_SECRET, so a
 * link cannot be forged for someone else's address and needs no database row to
 * check. Tokens do not expire: an unsubscribe link has to keep working.
 * Pure apart from the Web Crypto HMAC, so it can be tested without an engine.
 */

const enc = new TextEncoder()
const SIG_LENGTH = 40
const PURPOSE = 'email-unsubscribe'

const toHex = (buf: ArrayBuffer): string =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')

const hexOf = (value: string): string => Array.from(enc.encode(value), (b) => b.toString(16).padStart(2, '0')).join('')

const fromHex = (hex: string): string | null => {
  if (!/^(?:[0-9a-f]{2})+$/.test(hex)) return null
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return new TextDecoder().decode(bytes)
}

async function signature(secret: string, email: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${PURPOSE}|${email}`))
  return toHex(mac).slice(0, SIG_LENGTH)
}

/** The address is lower-cased first, so the same mailbox always gets the same token. */
export async function signUnsubscribeToken(secret: string, address: string): Promise<string> {
  const email = address.trim().toLowerCase()
  return `${hexOf(email)}.${await signature(secret, email)}`
}

/** The address a token was made for, or null when the token is malformed or its signature does not match. */
export async function verifyUnsubscribeToken(secret: string, token: string): Promise<string | null> {
  if (!secret || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const email = fromHex(parts[0])
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  const expected = await signature(secret, email)
  if (expected.length !== parts[1].length) return null
  let diff = 0
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ parts[1].charCodeAt(i)
  return diff === 0 ? email : null
}

/** The absolute unsubscribe link for one address. `base` is the site origin with no trailing slash. */
export async function unsubscribeUrlFor(base: string, secret: string, address: string): Promise<string> {
  return `${base}/api/email-unsubscribe?t=${encodeURIComponent(await signUnsubscribeToken(secret, address))}`
}

/** The two headers mail clients use for their own unsubscribe button (RFC 2369 and RFC 8058 one-click). */
export function unsubscribeHeaders(url: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}

const escapeAttribute = (value: string): string => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** Adds the unsubscribe line at the end of an HTML body. */
export function withHtmlFooter(html: string, url: string): string {
  if (html.includes(url)) return html
  return `${html}<p style="font-size:12px;color:#666;font-family:system-ui,sans-serif">Not interested any more? <a href="${escapeAttribute(url)}">Unsubscribe</a> from these emails.</p>`
}

/** Adds the unsubscribe line at the end of a plain text body. */
export function withTextFooter(text: string, url: string): string {
  if (text.includes(url)) return text
  return `${text}\n\n---\nNot interested any more? Unsubscribe from these emails: ${url}`
}
