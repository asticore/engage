// @vitest-environment node
// Task 7 (integrations leftovers): unsubscribe links, suppression rules, provider bounce feed,
// custom headers on each adapter, and the sitemap submit helpers. Pure: no database, no network.
import { afterEach, describe, expect, it, vi } from 'vitest'

import { sendViaPostmark } from '@/features/email/providers/postmark'
import { sendViaResend } from '@/features/email/providers/resend'
import { parsePostmarkEvent, sameSecret } from '@/features/email/providerEvents'
import { statusFor } from '@/features/email/emailLog'
import {
  signUnsubscribeToken,
  unsubscribeHeaders,
  unsubscribeUrlFor,
  verifyUnsubscribeToken,
  withHtmlFooter,
  withTextFooter,
} from '@/features/email/unsubscribe'
import { sitemapFeedFor, sitemapSubmitUrl } from '@/features/google/sitemaps'
import { GOOGLE_SCOPES } from '@/features/google/constants'

const SECRET = 'test-secret-value'
const message = { to: ['a@example.com'], subject: 'Hi', text: 'Hello', fromEmail: 'from@example.com', fromName: 'Shop', headers: { 'List-Unsubscribe': '<https://x.test/u>' } }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('unsubscribe tokens', () => {
  it('round-trips an address, ignoring case and spaces', async () => {
    const token = await signUnsubscribeToken(SECRET, '  Pat.Smith@Example.COM ')
    expect(await verifyUnsubscribeToken(SECRET, token)).toBe('pat.smith@example.com')
  })

  it('refuses a token made with another secret, a changed address or a malformed value', async () => {
    const token = await signUnsubscribeToken(SECRET, 'pat@example.com')
    expect(await verifyUnsubscribeToken('other-secret', token)).toBeNull()
    const [, sig] = token.split('.')
    const otherAddress = Array.from(new TextEncoder().encode('bob@example.com'), (b) => b.toString(16).padStart(2, '0')).join('')
    expect(await verifyUnsubscribeToken(SECRET, `${otherAddress}.${sig}`)).toBeNull()
    expect(await verifyUnsubscribeToken(SECRET, 'nonsense')).toBeNull()
    expect(await verifyUnsubscribeToken('', token)).toBeNull()
    expect(await verifyUnsubscribeToken(SECRET, `zz.${sig}`)).toBeNull()
  })

  it('builds an absolute link with the token encoded', async () => {
    const url = await unsubscribeUrlFor('https://shop.test', SECRET, 'pat@example.com')
    expect(url.startsWith('https://shop.test/api/email-unsubscribe?t=')).toBe(true)
    const token = decodeURIComponent(url.split('t=')[1])
    expect(await verifyUnsubscribeToken(SECRET, token)).toBe('pat@example.com')
  })

  it('sends the RFC 8058 one-click pair of headers', () => {
    expect(unsubscribeHeaders('https://shop.test/u?t=1')).toEqual({
      'List-Unsubscribe': '<https://shop.test/u?t=1>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    })
  })
})

describe('unsubscribe footers', () => {
  it('adds one link to HTML and text, and never a second copy of the same link', () => {
    const url = 'https://shop.test/api/email-unsubscribe?t=abc.def'
    const html = withHtmlFooter('<p>Hi</p>', url)
    expect(html).toContain(`href="${url}"`)
    expect(withHtmlFooter(html, url)).toBe(html)
    const text = withTextFooter('Hi', url)
    expect(text).toContain(`Unsubscribe from these emails: ${url}`)
    expect(withTextFooter(text, url)).toBe(text)
  })

  it('escapes the link when it goes into an attribute', () => {
    expect(withHtmlFooter('<p>Hi</p>', 'https://x.test/u?a=1&b="2"')).toContain('href="https://x.test/u?a=1&amp;b=&quot;2&quot;"')
  })
})

describe('provider bounce and complaint feed (Postmark)', () => {
  it('suppresses hard bounces, inactive recipients and spam complaints', () => {
    expect(parsePostmarkEvent({ RecordType: 'Bounce', Type: 'HardBounce', Email: ' Gone@Example.com ' })).toEqual({ address: 'gone@example.com', reason: 'bounced', type: 'HardBounce' })
    expect(parsePostmarkEvent({ RecordType: 'Bounce', Type: 'BadEmailAddress', Email: 'x@example.com', Inactive: true })?.reason).toBe('bounced')
    expect(parsePostmarkEvent({ RecordType: 'SpamComplaint', Email: 'angry@example.com' })?.reason).toBe('complaint')
    expect(parsePostmarkEvent({ RecordType: 'SubscriptionChange', Recipient: 'opt@example.com', SuppressSending: true })?.reason).toBe('provider')
  })

  it('ignores soft bounces, delivery notices, unsubscribes that do not suppress, and unreadable records', () => {
    expect(parsePostmarkEvent({ RecordType: 'Bounce', Type: 'SoftBounce', Email: 'full@example.com' })).toBeNull()
    expect(parsePostmarkEvent({ RecordType: 'Delivery', Email: 'ok@example.com' })).toBeNull()
    expect(parsePostmarkEvent({ RecordType: 'SubscriptionChange', Recipient: 'x@example.com', SuppressSending: false })).toBeNull()
    expect(parsePostmarkEvent({ RecordType: 'SpamComplaint', Email: 'not-an-address' })).toBeNull()
    expect(parsePostmarkEvent(null)).toBeNull()
    expect(parsePostmarkEvent('text')).toBeNull()
  })

  it('compares the webhook key without accepting a blank or partial match', () => {
    expect(sameSecret('abc123', 'abc123')).toBe(true)
    expect(sameSecret('abc123', 'abc12')).toBe(false)
    expect(sameSecret('abc123', '')).toBe(false)
    expect(sameSecret('', '')).toBe(false)
  })
})

describe('custom headers reach the provider', () => {
  it('Postmark sends them as a Headers list', async () => {
    const seen: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      seen.push(String(init.body))
      return new Response(JSON.stringify({ MessageID: 'm1', ErrorCode: 0 }), { status: 200 })
    }))
    const result = await sendViaPostmark(message, { serverToken: 't' })
    expect(result.ok).toBe(true)
    expect(JSON.parse(seen[0]).Headers).toEqual([{ Name: 'List-Unsubscribe', Value: '<https://x.test/u>' }])
  })

  it('Resend sends them as a headers object, and omits the key when there are none', async () => {
    const bodies: Record<string, unknown>[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)))
      return new Response(JSON.stringify({ id: 'r1' }), { status: 200 })
    }))
    await sendViaResend(message, { apiKey: 'k' })
    await sendViaResend({ ...message, headers: undefined }, { apiKey: 'k' })
    expect(bodies[0].headers).toEqual({ 'List-Unsubscribe': '<https://x.test/u>' })
    expect('headers' in bodies[1]).toBe(false)
  })
})

describe('email log status for a suppressed send', () => {
  it('is logged as skipped, not failed', () => {
    expect(statusFor({ ok: false, reason: 'suppressed' })).toBe('skipped')
  })
})

describe('Search Console sitemap submit', () => {
  it('builds the sitemap address from SITE_URL and nothing else', () => {
    expect(sitemapFeedFor('https://shop.test/')).toBe('https://shop.test/sitemap.xml')
    expect(sitemapFeedFor('')).toBe('')
  })

  it('encodes the property and the feed in the PUT address', () => {
    expect(sitemapSubmitUrl('https://shop.test/', 'https://shop.test/sitemap.xml')).toBe(
      'https://www.googleapis.com/webmasters/v3/sites/https%3A%2F%2Fshop.test%2F/sitemaps/https%3A%2F%2Fshop.test%2Fsitemap.xml',
    )
  })

  it('asks for the full webmasters scope, which the submit needs', () => {
    expect(GOOGLE_SCOPES).toContain('https://www.googleapis.com/auth/webmasters')
    expect(GOOGLE_SCOPES).not.toContain('https://www.googleapis.com/auth/webmasters.readonly')
  })
})
