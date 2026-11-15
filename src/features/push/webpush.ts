/**
 * Web push, pure WebCrypto: the VAPID signature (RFC 8292) and the encrypted payload (RFC 8291, aes128gcm).
 * No database and no network here, so it tests on its own.
 */

const enc = new TextEncoder()

export const b64urlEncode = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const b64urlDecode = (value: string): Uint8Array => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i)
  return out
}

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

export type VapidKeys = { publicKey: string; privateJwk: JsonWebKey }

/** A new VAPID key pair: the public key as the 65 byte point (base64url, what the browser needs) and the private key as a JWK. */
export async function generateVapidKeys(): Promise<VapidKeys> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
  const raw = new Uint8Array((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer)
  return { publicKey: b64urlEncode(raw), privateJwk: (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey }
}

/** The Authorization header for one push service: a signed token naming the service's origin. */
export async function vapidAuthorization(endpoint: string, keys: VapidKeys, subject: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<string> {
  const audience = new URL(endpoint).origin
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64urlEncode(enc.encode(JSON.stringify({ aud: audience, exp: nowSeconds + 12 * 60 * 60, sub: subject })))
  const key = await crypto.subtle.importKey('jwk', keys.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`)))
  return `vapid t=${header}.${claims}.${b64urlEncode(signature)}, k=${keys.publicKey}`
}

const hkdf = async (salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> => {
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource }, key, bytes * 8))
}

export type PushSubscriptionKeys = { p256dh: string; auth: string }

/** Encrypts a payload for one subscription: the aes128gcm body a push service forwards to the browser. */
export async function encryptPayload(payload: string, subscription: PushSubscriptionKeys, salt: Uint8Array = crypto.getRandomValues(new Uint8Array(16))): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(subscription.p256dh)
  const authSecret = b64urlDecode(subscription.auth)
  const ephemeral = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
  const asPublic = new Uint8Array((await crypto.subtle.exportKey('raw', ephemeral.publicKey)) as ArrayBuffer)
  const uaKey = await crypto.subtle.importKey('raw', uaPublic as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, ephemeral.privateKey, 256))
  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32)
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)
  const plain = concat(enc.encode(payload), new Uint8Array([2]))
  const aes = await crypto.subtle.importKey('raw', cek as BufferSource, 'AES-GCM', false, ['encrypt'])
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as BufferSource }, aes, plain as BufferSource))
  const header = concat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPublic.length]), asPublic)
  return concat(header, cipher)
}

/** Whether a stored subscription is usable: an https endpoint and both keys at the right length. */
export function validSubscription(input: unknown): { endpoint: string; p256dh: string; auth: string } | null {
  const s = (input && typeof input === 'object' ? input : {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
  if (typeof s.endpoint !== 'string' || s.endpoint.length > 1000) return null
  try {
    if (new URL(s.endpoint).protocol !== 'https:') return null
  } catch {
    return null
  }
  const p256dh = typeof s.keys?.p256dh === 'string' ? s.keys.p256dh : ''
  const auth = typeof s.keys?.auth === 'string' ? s.keys.auth : ''
  try {
    if (b64urlDecode(p256dh).length !== 65 || b64urlDecode(auth).length !== 16) return null
  } catch {
    return null
  }
  return { endpoint: s.endpoint, p256dh, auth }
}
