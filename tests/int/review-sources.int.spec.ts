import { describe, expect, it } from 'vitest'

import { fetchReviews, redactKey, validPlaceId } from '@/features/reviewSources/adapters'
import { clearReviewCache, getReviews } from '@/features/reviewSources/service'
import type { ReviewAccount } from '@/features/reviewSources/types'
import { liveReviewItems } from '@/components/blocks/elements/ReviewsLive'

const acct = (provider: ReviewAccount['provider']): ReviewAccount => ({ id: '1', provider, label: 'x', accountId: 'ChIJabc123', token: 'SECRETKEY' })
const reply = (body: unknown, ok = true) => async () => ({ ok, status: ok ? 200 : 403, text: async () => JSON.stringify(body) }) as unknown as Response

describe('live review sources', () => {
  it('parses Google reviews and labels the source', async () => {
    const r = await fetchReviews(acct('google-reviews'), '', reply({ reviews: [{ rating: 5, text: { text: 'Great' }, publishTime: '2026-01-01T00:00:00Z', authorAttribution: { displayName: 'Ann', uri: 'https://maps.google.com/x' } }] }))
    expect(r).toEqual([{ name: 'Ann', rating: 5, text: 'Great', date: '2026-01-01T00:00:00.000Z', url: 'https://maps.google.com/x', source: 'Google' }])
  })
  it('parses Yelp and Facebook (recommendation maps to stars)', async () => {
    const y = await fetchReviews(acct('yelp-reviews'), 'biz-1', reply({ reviews: [{ rating: 4, text: 'Nice', user: { name: 'Bo' }, url: 'https://yelp.com/r' }] }))
    expect(y[0]).toMatchObject({ name: 'Bo', rating: 4, source: 'Yelp' })
    const f = await fetchReviews(acct('facebook-reviews'), '', reply({ data: [{ recommendation_type: 'positive', review_text: 'Yes', reviewer: { name: 'Cy' } }] }))
    expect(f[0]).toMatchObject({ rating: 5, source: 'Facebook' })
  })
  it('refuses bad IDs, missing keys and never leaks the key', async () => {
    expect(validPlaceId('a/../b')).toBe('')
    await expect(fetchReviews(acct('yelp-reviews'), 'bad id!', reply({}))).rejects.toThrow('valid')
    await expect(fetchReviews({ ...acct('yelp-reviews'), token: '' }, 'abc', reply({}))).rejects.toThrow('No key')
    const boom = async () => { throw new Error('failed https://x?key=SECRETKEY') }
    await expect(fetchReviews(acct('google-reviews'), '', boom as never)).rejects.not.toThrow(/SECRETKEY/)
    expect(redactKey('a SECRETKEY b', 'SECRETKEY')).toBe('a *** b')
  })
  it('caches, and serves stale data when the provider fails', async () => {
    clearReviewCache()
    let calls = 0
    const ok = async () => { calls++; return reply({ reviews: [{ rating: 5, text: { text: 'Hi' }, authorAttribution: { displayName: 'A' } }] })() }
    await getReviews(acct('google-reviews'), '', ok as never, 1000)
    await getReviews(acct('google-reviews'), '', ok as never, 2000)
    expect(calls).toBe(1)
    const fail = reply({}, false)
    const later = await getReviews(acct('google-reviews'), '', fail as never, 1000 + 7 * 3600 * 1000)
    expect(later).toHaveLength(1)
  })
  it('turns live reviews into element rows', () => {
    expect(liveReviewItems([{ name: 'A', rating: null, text: 't', date: '', url: '', source: 'Yelp' }])).toEqual([{ name: 'A', rating: '', text: 't', source: 'Yelp' }])
  })
})
