import { describe, expect, it } from 'vitest'

import { pushToAll } from '@/features/push/send'
import { b64urlDecode, b64urlEncode, encryptPayload, generateVapidKeys, validSubscription, vapidAuthorization } from '@/features/push/webpush'

const enc = new TextEncoder()
const hkdf = async (salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) => {
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource }, key, bytes * 8))
}

async function subscriber() {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
  const p256dh = new Uint8Array((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer)
  const auth = crypto.getRandomValues(new Uint8Array(16))
  return { pair, p256dh, auth, keys: { p256dh: b64urlEncode(p256dh), auth: b64urlEncode(auth) } }
}

/** The receiving side of RFC 8291, written out separately to prove the sender's bytes can be read. */
async function decrypt(body: Uint8Array, sub: Awaited<ReturnType<typeof subscriber>>): Promise<string> {
  const salt = body.slice(0, 16)
  const idlen = body[20]
  const asPublic = body.slice(21, 21 + idlen)
  const cipher = body.slice(21 + idlen)
  const asKey = await crypto.subtle.importKey('raw', asPublic as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, sub.pair.privateKey, 256))
  const info = new Uint8Array([...enc.encode('WebPush: info\0'), ...sub.p256dh, ...asPublic])
  const ikm = await hkdf(sub.auth, shared, info, 32)
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)
  const aes = await crypto.subtle.importKey('raw', cek as BufferSource, 'AES-GCM', false, ['decrypt'])
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce as BufferSource }, aes, cipher as BufferSource))
  expect(plain[plain.length - 1]).toBe(2)
  return new TextDecoder().decode(plain.slice(0, -1))
}

describe('web push', () => {
  it('encrypts a payload the subscriber can read', async () => {
    const sub = await subscriber()
    const body = await encryptPayload('{"title":"Hi ☕"}', sub.keys)
    expect(await decrypt(body, sub)).toBe('{"title":"Hi ☕"}')
  })
  it('signs a VAPID token for the push service origin that verifies with the public key', async () => {
    const keys = await generateVapidKeys()
    const header = await vapidAuthorization('https://push.example.com/send/abc', keys, 'mailto:a@example.com', 1_000_000)
    const [, token, k] = /^vapid t=(.+), k=(.+)$/.exec(header)!
    expect(k).toBe(keys.publicKey)
    const [h, c, s] = token.split('.')
    expect(JSON.parse(new TextDecoder().decode(b64urlDecode(c)))).toEqual({ aud: 'https://push.example.com', exp: 1_000_000 + 43_200, sub: 'mailto:a@example.com' })
    const pub = await crypto.subtle.importKey('raw', b64urlDecode(k) as BufferSource, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    expect(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64urlDecode(s) as BufferSource, enc.encode(`${h}.${c}`))).toBe(true)
  })
  it('accepts a good subscription and refuses bad ones', async () => {
    const sub = await subscriber()
    expect(validSubscription({ endpoint: 'https://push.example.com/x', keys: sub.keys })).not.toBeNull()
    expect(validSubscription({ endpoint: 'http://push.example.com/x', keys: sub.keys })).toBeNull()
    expect(validSubscription({ endpoint: 'https://push.example.com/x', keys: { p256dh: 'abc', auth: sub.keys.auth } })).toBeNull()
    expect(validSubscription(null)).toBeNull()
  })
  it('sends to each subscription and reports the gone ones', async () => {
    const keys = await generateVapidKeys()
    const a = await subscriber()
    const b = await subscriber()
    const calls: string[] = []
    const fetcher = (async (url: string) => {
      calls.push(url)
      return new Response(null, { status: url.includes('gone') ? 410 : 201 })
    }) as unknown as typeof fetch
    const result = await pushToAll(
      [{ id: 1, endpoint: 'https://push.example.com/ok', ...a.keys }, { id: 2, endpoint: 'https://push.example.com/gone', ...b.keys }],
      { title: 'T', body: 'B' },
      keys,
      'mailto:a@example.com',
      fetcher,
    )
    expect(result).toEqual({ sent: 1, removed: ['https://push.example.com/gone'], failed: 0 })
    expect(calls).toHaveLength(2)
  })
})
