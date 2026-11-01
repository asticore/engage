import { describe, expect, it } from 'vitest'

import {
  parseBrevoEvent,
  parseMailgunEvent,
  parseMandrillEvents,
  parseResendEvent,
  parseSendgridEvents,
  parseSesMessage,
} from '@/features/email/providerEvents'
import { derEcdsaToRaw, isSnsUrl, verifyMailgun, verifyMandrill, verifyResend, verifySendgrid, verifySnsMessage } from '@/features/email/providerSignatures'
import { shippedOrderPhone, shippedOrderTextBody } from '@/features/sms/shippedText'

const enc = new TextEncoder()
const b64 = (buf: ArrayBuffer | Uint8Array): string => btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)))
const hex = (buf: ArrayBuffer): string => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

async function hmacKey(hash: 'SHA-1' | 'SHA-256', raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash }, false, ['sign'])
}

describe('provider bounce and complaint parsers', () => {
  it('Resend: a permanent bounce and a complaint, not a transient bounce', () => {
    expect(parseResendEvent({ type: 'email.bounced', data: { to: ['Gone@Example.com'], bounce: { type: 'Permanent' } } })).toEqual([
      { address: 'gone@example.com', reason: 'bounced', type: 'Permanent' },
    ])
    expect(parseResendEvent({ type: 'email.complained', data: { to: ['angry@example.com'] } })[0]?.reason).toBe('complaint')
    expect(parseResendEvent({ type: 'email.bounced', data: { to: ['full@example.com'], bounce: { type: 'Transient' } } })).toEqual([])
    expect(parseResendEvent({ type: 'email.delivered', data: { to: ['ok@example.com'] } })).toEqual([])
  })

  it('SendGrid: bounce and spamreport, skipping other events and unreadable addresses', () => {
    const out = parseSendgridEvents([
      { event: 'bounce', email: 'Gone@Example.com' },
      { event: 'spamreport', email: 'angry@example.com' },
      { event: 'deferred', email: 'later@example.com' },
      { event: 'bounce', email: 'not-an-address' },
    ])
    expect(out.map((e) => [e.address, e.reason])).toEqual([
      ['gone@example.com', 'bounced'],
      ['angry@example.com', 'complaint'],
    ])
    expect(parseSendgridEvents({ event: 'bounce' })).toEqual([])
  })

  it('Mailgun: permanent failures and complaints only', () => {
    expect(parseMailgunEvent({ event: 'failed', severity: 'permanent', recipient: 'Gone@Example.com' })).toEqual([{ address: 'gone@example.com', reason: 'bounced', type: 'failed' }])
    expect(parseMailgunEvent({ event: 'failed', severity: 'temporary', recipient: 'full@example.com' })).toEqual([])
    expect(parseMailgunEvent({ event: 'complained', recipient: 'angry@example.com' })[0]?.reason).toBe('complaint')
    expect(parseMailgunEvent({ event: 'delivered', recipient: 'ok@example.com' })).toEqual([])
  })

  it('Brevo: hard bounces, invalid and blocked addresses, and spam reports', () => {
    expect(parseBrevoEvent({ event: 'hard_bounce', email: 'Gone@Example.com' })?.[0]?.reason).toBe('bounced')
    expect(parseBrevoEvent({ event: 'invalid_email', email: 'typo@example.com' })).toHaveLength(1)
    expect(parseBrevoEvent({ event: 'spam', email: 'angry@example.com' })?.[0]?.reason).toBe('complaint')
    expect(parseBrevoEvent({ event: 'soft_bounce', email: 'full@example.com' })).toEqual([])
    expect(parseBrevoEvent('text')).toEqual([])
  })

  it('Mandrill: hard bounces and spam, from the JSON array of events', () => {
    const out = parseMandrillEvents([
      { event: 'hard_bounce', msg: { email: 'Gone@Example.com' } },
      { event: 'spam', msg: { email: 'angry@example.com' } },
      { event: 'send', msg: { email: 'ok@example.com' } },
    ])
    expect(out.map((e) => e.reason)).toEqual(['bounced', 'complaint'])
    expect(parseMandrillEvents({})).toEqual([])
  })

  it('SES: permanent bounces and complaints per recipient, transient bounces ignored', () => {
    expect(
      parseSesMessage({ notificationType: 'Bounce', bounce: { bounceType: 'Permanent', bouncedRecipients: [{ emailAddress: 'Gone@Example.com' }, { emailAddress: 'two@example.com' }] } }),
    ).toEqual([
      { address: 'gone@example.com', reason: 'bounced', type: 'Permanent' },
      { address: 'two@example.com', reason: 'bounced', type: 'Permanent' },
    ])
    expect(parseSesMessage({ notificationType: 'Bounce', bounce: { bounceType: 'Transient', bouncedRecipients: [{ emailAddress: 'full@example.com' }] } })).toEqual([])
    expect(parseSesMessage({ notificationType: 'Complaint', complaint: { complainedRecipients: [{ emailAddress: 'angry@example.com' }] } })[0]?.reason).toBe('complaint')
    expect(parseSesMessage({ notificationType: 'Delivery' })).toEqual([])
  })
})

describe('provider signatures', () => {
  it('Resend (Svix): accepts a correct v1 signature and refuses a changed body, a stale timestamp or a wrong secret', async () => {
    const secretBytes = enc.encode('0123456789abcdef0123456789abcdef')
    const secret = `whsec_${b64(secretBytes)}`
    const id = 'msg_1'
    const now = 1_800_000_000
    const body = '{"type":"email.bounced"}'
    const sig = b64(await crypto.subtle.sign('HMAC', await hmacKey('SHA-256', secretBytes), enc.encode(`${id}.${now}.${body}`)))
    const headers = new Headers({ 'svix-id': id, 'svix-timestamp': String(now), 'svix-signature': `v1,${sig}` })
    expect(await verifyResend(headers, body, secret, now)).toBe(true)
    expect(await verifyResend(headers, body + ' ', secret, now)).toBe(false)
    expect(await verifyResend(headers, body, secret, now + 3600)).toBe(false)
    expect(await verifyResend(headers, body, `whsec_${b64(enc.encode('another-secret-another-secret!!'))}`, now)).toBe(false)
    expect(await verifyResend(new Headers(), body, secret, now)).toBe(false)
  })

  it('Mailgun: HMAC of timestamp and token, refused when stale or wrong', async () => {
    const key = 'key-test-signing'
    const timestamp = String(1_800_000_000)
    const token = 'abc123'
    const signature = hex(await crypto.subtle.sign('HMAC', await hmacKey('SHA-256', enc.encode(key)), enc.encode(timestamp + token)))
    expect(await verifyMailgun({ timestamp, token, signature }, key, 1_800_000_010)).toBe(true)
    expect(await verifyMailgun({ timestamp, token, signature }, 'other-key', 1_800_000_010)).toBe(false)
    expect(await verifyMailgun({ timestamp, token, signature }, key, 1_800_001_000)).toBe(false)
    expect(await verifyMailgun(undefined, key, 1_800_000_010)).toBe(false)
  })

  it('Mandrill: base64 HMAC-SHA1 of the URL plus sorted form fields', async () => {
    const url = 'https://example.com/api/email-events/mandrill'
    const fields = { mandrill_events: '[]', z: '1' }
    const data = url + 'mandrill_events[]z1'
    const given = b64(await crypto.subtle.sign('HMAC', await hmacKey('SHA-1', enc.encode('mkey')), enc.encode(data)))
    expect(await verifyMandrill(url, fields, 'mkey', given)).toBe(true)
    expect(await verifyMandrill(url.replace('https', 'http'), fields, 'mkey', given)).toBe(false)
    expect(await verifyMandrill(url, fields, 'nope', given)).toBe(false)
  })

  it('SendGrid: ECDSA P-256 over timestamp plus body, with the DER signature converted to raw form', async () => {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
    const publicKey = b64(await crypto.subtle.exportKey('spki', pair.publicKey))
    const timestamp = String(1_800_000_000)
    const body = '[{"event":"bounce","email":"gone@example.com"}]'
    const raw = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, enc.encode(timestamp + body)))
    const toDer = (part: Uint8Array): number[] => {
      let start = 0
      while (start < 31 && part[start] === 0) start += 1
      const trimmed = [...part.slice(start)]
      if (trimmed[0] & 0x80) trimmed.unshift(0)
      return [0x02, trimmed.length, ...trimmed]
    }
    const inner = [...toDer(raw.slice(0, 32)), ...toDer(raw.slice(32))]
    const der = b64(new Uint8Array([0x30, inner.length, ...inner]))
    expect(await verifySendgrid(publicKey, timestamp, body, der, 1_800_000_010)).toBe(true)
    expect(await verifySendgrid(publicKey, timestamp, body + ' ', der, 1_800_000_010)).toBe(false)
    expect(await verifySendgrid(publicKey, timestamp, body, der, 1_800_001_000)).toBe(false)
    expect(derEcdsaToRaw(new Uint8Array([0x31, 0x00]))).toBeNull()
  })

  it('SNS (SES): refuses a certificate URL that is not on AWS, an unknown signature version and an unknown message type', async () => {
    expect(isSnsUrl('https://sns.eu-west-1.amazonaws.com/SimpleNotificationService.pem')).toBe(true)
    expect(isSnsUrl('https://sns.example.com/cert.pem')).toBe(false)
    expect(isSnsUrl('http://sns.eu-west-1.amazonaws.com/x.pem')).toBe(false)
    expect(await verifySnsMessage({ Type: 'Notification', SigningCertURL: 'https://evil.example.com/c.pem', Signature: 'x', SignatureVersion: '2' })).toBe(false)
    expect(await verifySnsMessage({ Type: 'Notification', SigningCertURL: 'https://sns.eu-west-1.amazonaws.com/c.pem', Signature: 'x', SignatureVersion: '9' })).toBe(false)
    expect(await verifySnsMessage({ Type: 'Other', SigningCertURL: 'https://sns.eu-west-1.amazonaws.com/c.pem', Signature: 'x', SignatureVersion: '2' })).toBe(false)
  })
})

describe('shipped-order text', () => {
  const order = {
    id: 42,
    orderNumber: 'A-42',
    trackingCarrier: 'Australia Post',
    trackingNumber: 'AP1',
    trackingUrl: 'https://track.example/AP1',
    shippingAddress: { phone: '+61 400 000 000' },
  }

  it('reads the order phone in international format and skips anything else', () => {
    expect(shippedOrderPhone(order)).toBe('+61400000000')
    expect(shippedOrderPhone({ shippingAddress: { phone: '0400 000 000' } })).toBeNull()
    expect(shippedOrderPhone({ shippingAddress: {} })).toBeNull()
  })

  it('names the order, the carrier and the tracking link in one short text', () => {
    expect(shippedOrderTextBody(order, 'Grace')).toBe('Grace: Your order #A-42 has shipped with Australia Post. Track it: https://track.example/AP1')
    expect(shippedOrderTextBody({ id: 7, trackingNumber: 'T9' })).toBe('Your order #7 has shipped. Tracking number: T9')
  })
})
