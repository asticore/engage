import { isStoredFile } from './upload'

/**
 * Signed, expiring links to files visitors attached to entries.
 *
 * Another system (the data API, a webhook receiver, a forwarded email) cannot
 * sign in to the admin, so it gets a link instead of the file: the link names
 * one stored file and a deadline and carries an HMAC made with ENGAGE_SECRET.
 * It cannot be changed to reach another file and stops working at the deadline.
 * Without ENGAGE_SECRET no link is made (the file is listed without a url).
 */

const enc = new TextEncoder()
const PURPOSE = 'form-file-link'
export const DEFAULT_LINK_SECONDS = 7 * 24 * 3600

const toHex = (buf: ArrayBuffer): string => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')

async function mac(secret: string, key: string, expires: number): Promise<string> {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toHex(await crypto.subtle.sign('HMAC', k, enc.encode(`${PURPOSE}|${key}|${expires}`)))
}

export async function signFileLink(secret: string, key: string, origin: string, now = Date.now(), seconds = DEFAULT_LINK_SECONDS): Promise<string> {
  const expires = Math.floor(now / 1000) + seconds
  const params = new URLSearchParams({ key, exp: String(expires), sig: await mac(secret, key, expires) })
  return `${origin}/api/form-file-link?${params.toString()}`
}

export async function verifyFileLink(secret: string, key: string, exp: string, sig: string, now = Date.now()): Promise<boolean> {
  if (!secret || !key || !/^\d{1,12}$/.test(exp) || !/^[0-9a-f]{64}$/.test(sig)) return false
  const expires = Number(exp)
  if (expires * 1000 < now) return false
  const expected = await mac(secret, key, expires)
  let diff = 0
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  return diff === 0
}

export type LinkedFile = { name: string; size: number; type: string; url?: string }

/** Copy of `values` with every stored file replaced by name, size, type and a signed link. */
export async function withFileLinks(
  values: Record<string, unknown>,
  origin: string,
  secret = process.env.ENGAGE_SECRET || '',
  now = Date.now(),
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  const convert = async (value: unknown): Promise<unknown> => {
    if (!isStoredFile(value)) return value
    const file: LinkedFile = { name: value.name, size: value.size, type: value.type }
    if (secret && origin) file.url = await signFileLink(secret, value.key, origin, now)
    return file
  }
  for (const [name, value] of Object.entries(values)) {
    out[name] = Array.isArray(value) ? await Promise.all(value.map(convert)) : await convert(value)
  }
  return out
}
