import { describe, expect, it } from 'vitest'

import { normaliseFormConfig } from '@/features/forms/config'
import { buildRequestInput, normaliseRequestFeed, NO_REQUEST_FEED } from '@/features/forms/requestFeed'
import { parseRequest } from '@/features/quotes/logic'

const feed = normaliseRequestFeed({ enabled: true, kind: 'bid', productId: 7, map: { name: 'n', email: 'e', offer: 'o', bogus: 'x', phone: 'bad name!' } })

describe('form request feed', () => {
  it('defaults off and cleans the settings', () => {
    expect(normaliseRequestFeed(undefined)).toEqual(NO_REQUEST_FEED)
    expect(feed.map).toEqual({ name: 'n', email: 'e', offer: 'o' })
    expect(normaliseFormConfig({ requestFeed: { enabled: true, kind: 'nope' } }).requestFeed?.kind).toBe('quote')
  })
  it('builds nothing when off', () => {
    expect(buildRequestInput(NO_REQUEST_FEED, {}, '', '')).toBeNull()
  })
  it('turns an entry into a valid request', () => {
    const body = buildRequestInput(feed, { n: 'Sam', e: 'Sam@Example.com', o: '$120.50' }, 'all answers', '/contact')
    const parsed = parseRequest(body)
    expect(parsed.ok && parsed.value).toMatchObject({ kind: 'bid', name: 'Sam', email: 'sam@example.com', offerCents: 12050, productId: 7, details: 'all answers', pageUrl: '/contact' })
  })
  it('lets a choice field pick the product and keeps mapped details', () => {
    const f = normaliseRequestFeed({ enabled: true, productId: 7, productField: 'p', map: { name: 'n', email: 'e', details: 'd', quantity: 'q' } })
    const parsed = parseRequest(buildRequestInput(f, { n: 'A', e: 'a@b.co', d: 'Need 5', q: 5, p: '12:abc' }, 'x', ''))
    expect(parsed.ok && parsed.value).toMatchObject({ productId: 12, details: 'Need 5', quantity: 5 })
  })
  it('refuses an entry without a valid email', () => {
    expect(parseRequest(buildRequestInput(feed, { n: 'Sam', e: 'nope', o: '5' }, 'x', '')).ok).toBe(false)
  })
})
