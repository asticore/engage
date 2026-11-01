import { sameSecret } from './providerEvents'

/**
 * Checks that a provider's delivery report really came from the provider (task 7b). One function per
 * provider, each following that provider's documented scheme. Every check returns false rather than
 * throwing, so a bad or unknown signature is refused with 401. A report older than five minutes is
 * refused too, where the provider sends a timestamp.
 *
 * SES sends through SNS, whose messages are signed with an RSA key named by the certificate in each message.
 */

const enc = new TextEncoder()
const MAX_AGE_SECONDS = 300

const fromB64 = (value: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(value)
  const out = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i)
  return out
}
const toB64 = (buffer: ArrayBuffer): string => btoa(String.fromCharCode(...new Uint8Array(buffer)))
const toHex = (buffer: ArrayBuffer): string => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')

async function hmac(hash: 'SHA-1' | 'SHA-256', key: string | Uint8Array<ArrayBuffer>, data: string): Promise<ArrayBuffer> {
  const raw = typeof key === 'string' ? enc.encode(key) : key
  const cryptoKey = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash }, false, ['sign'])
  return crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data))
}

const fresh = (timestampSeconds: number, now: number): boolean => Number.isFinite(timestampSeconds) && Math.abs(now - timestampSeconds) <= MAX_AGE_SECONDS

/** Resend uses Svix: HMAC-SHA256 over `id.timestamp.body`, keyed with the base64 part of the `whsec_` secret. */
export async function verifyResend(headers: Headers, rawBody: string, secret: string, now = Date.now() / 1000): Promise<boolean> {
  try {
    const id = headers.get('svix-id') ?? ''
    const timestamp = headers.get('svix-timestamp') ?? ''
    const signatures = headers.get('svix-signature') ?? ''
    if (!id || !timestamp || !signatures || !secret || !fresh(Number(timestamp), now)) return false
    const key = fromB64(secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret)
    const expected = toB64(await hmac('SHA-256', key, `${id}.${timestamp}.${rawBody}`))
    return signatures.split(' ').some((part) => {
      const [version, value] = part.split(',')
      return version === 'v1' && !!value && sameSecret(expected, value)
    })
  } catch {
    return false
  }
}

/** Mailgun (JSON webhooks): HMAC-SHA256 hex of `timestamp + token`, keyed with the account's webhook signing key. */
export async function verifyMailgun(signature: { timestamp?: unknown; token?: unknown; signature?: unknown } | null | undefined, signingKey: string, now = Date.now() / 1000): Promise<boolean> {
  try {
    const timestamp = typeof signature?.timestamp === 'string' ? signature.timestamp : ''
    const token = typeof signature?.token === 'string' ? signature.token : ''
    const given = typeof signature?.signature === 'string' ? signature.signature : ''
    if (!timestamp || !token || !given || !signingKey || !fresh(Number(timestamp), now)) return false
    return sameSecret(toHex(await hmac('SHA-256', signingKey, `${timestamp}${token}`)), given)
  } catch {
    return false
  }
}

/** Mandrill: HMAC-SHA1, base64. The data is the full webhook URL, then each form field name and value in name order. */
export async function verifyMandrill(url: string, fields: Record<string, string>, key: string, given: string): Promise<boolean> {
  try {
    if (!key || !given) return false
    const data = url + Object.keys(fields).sort().map((name) => name + fields[name]).join('')
    return sameSecret(toB64(await hmac('SHA-1', key, data)), given)
  } catch {
    return false
  }
}

/** SendGrid: ECDSA P-256 over `timestamp + body`, checked with the account's public key (base64 SPKI). The signature is DER. */
export async function verifySendgrid(publicKey: string, timestamp: string, rawBody: string, signature: string, now = Date.now() / 1000): Promise<boolean> {
  try {
    if (!publicKey || !timestamp || !signature || !fresh(Number(timestamp), now)) return false
    const raw = derEcdsaToRaw(fromB64(signature))
    if (!raw) return false
    const key = await crypto.subtle.importKey('spki', fromB64(publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, raw, enc.encode(timestamp + rawBody))
  } catch {
    return false
  }
}

/** Converts a DER ECDSA signature (SEQUENCE of two INTEGERs) into the 64-byte r||s form WebCrypto wants. */
export function derEcdsaToRaw(der: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> | null {
  if (der[0] !== 0x30) return null
  let offset = der[1] & 0x80 ? 2 + (der[1] & 0x7f) : 2
  const readInteger = (): Uint8Array<ArrayBuffer> | null => {
    if (der[offset] !== 0x02) return null
    const length = der[offset + 1]
    let value = der.slice(offset + 2, offset + 2 + length)
    offset += 2 + length
    while (value.length > 32 && value[0] === 0) value = value.slice(1)
    if (value.length > 32) return null
    const padded = new Uint8Array(new ArrayBuffer(32))
    padded.set(value, 32 - value.length)
    return padded
  }
  const r = readInteger()
  const s = readInteger()
  if (!r || !s) return null
  const out = new Uint8Array(new ArrayBuffer(64))
  out.set(r, 0)
  out.set(s, 32)
  return out
}

/** One DER element: its tag, where its content starts and ends, and where the next element begins. */
function readTlv(buffer: Uint8Array<ArrayBuffer>, offset: number): { tag: number; start: number; end: number; next: number } {
  const tag = buffer[offset]
  let length = buffer[offset + 1]
  let start = offset + 2
  if (length & 0x80) {
    const bytes = length & 0x7f
    length = 0
    for (let i = 0; i < bytes; i += 1) length = length * 256 + buffer[start + i]
    start += bytes
  }
  return { tag, start, end: start + length, next: start + length }
}

/** The SubjectPublicKeyInfo inside an X.509 certificate (DER). */
export function certificateSpki(der: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  const certificate = readTlv(der, 0)
  const tbs = readTlv(der, certificate.start)
  let offset = tbs.start
  if (der[offset] === 0xa0) offset = readTlv(der, offset).next // optional version
  for (let i = 0; i < 5; i += 1) offset = readTlv(der, offset).next // serial, signature, issuer, validity, subject
  const spki = readTlv(der, offset)
  return der.slice(offset, spki.next)
}

const SNS_CERT_URL = /^https:\/\/sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?\//

/** The SNS subscribe address must also be on amazonaws.com, so a confirmation can only go to AWS. */
export const isSnsUrl = (value: unknown): value is string => typeof value === 'string' && SNS_CERT_URL.test(value)

/** Verifies an SNS message from SES: the string to sign is built from fixed fields in name order, then checked with the certificate's key. */
export async function verifySnsMessage(message: Record<string, unknown>): Promise<boolean> {
  try {
    if (!isSnsUrl(message.SigningCertURL) || typeof message.Signature !== 'string') return false
    const type = message.Type
    const names =
      type === 'Notification'
        ? ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type']
        : type === 'SubscriptionConfirmation' || type === 'UnsubscribeConfirmation'
          ? ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type']
          : []
    if (names.length === 0) return false
    const stringToSign = names.filter((name) => message[name] !== undefined).map((name) => `${name}\n${String(message[name])}\n`).join('')
    const hash = message.SignatureVersion === '2' ? 'SHA-256' : message.SignatureVersion === '1' ? 'SHA-1' : null
    if (!hash) return false
    const certificate = await fetch(message.SigningCertURL, { redirect: 'error' })
    if (!certificate.ok) return false
    const pem = await certificate.text()
    const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
    const key = await crypto.subtle.importKey('spki', certificateSpki(fromB64(body)), { name: 'RSASSA-PKCS1-v1_5', hash }, false, ['verify'])
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromB64(message.Signature), enc.encode(stringToSign))
  } catch {
    return false
  }
}
