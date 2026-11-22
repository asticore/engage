// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { checkAkismet } from '@/features/forms/akismet'
import { describeSpamCounts } from '@/features/forms/spamCounts'

const reply = (text: string): typeof fetch => (async () => new Response(text)) as unknown as typeof fetch

describe('Akismet check', () => {
  it('flags a "true" answer as spam', async () => {
    expect((await checkAkismet({ key: 'abcdef123456', site: 'https://a.test', content: 'buy pills' }, reply('true'))).spam).toBe(true)
  })
  it('passes a "false" answer', async () => {
    expect((await checkAkismet({ key: 'abcdef123456', site: 'https://a.test', content: 'hello' }, reply('false'))).spam).toBe(false)
  })
  it('does nothing without a key or content', async () => {
    let called = false
    const f = (async () => { called = true; return new Response('true') }) as unknown as typeof fetch
    expect((await checkAkismet({ key: '', site: '', content: 'x' }, f)).spam).toBe(false)
    expect((await checkAkismet({ key: 'abcdef123456', site: '', content: ' ' }, f)).spam).toBe(false)
    expect(called).toBe(false)
  })
  it('fails open when Akismet cannot be reached', async () => {
    const f = (async () => { throw new Error('down') }) as unknown as typeof fetch
    expect((await checkAkismet({ key: 'abcdef123456', site: '', content: 'x' }, f)).spam).toBe(false)
  })
})

describe('Spam counters sentence', () => {
  it('is empty when nothing is held', () => {
    expect(describeSpamCounts({ forms: 0, formsWeek: 0, reviews: 0, reviewsWeek: 0, comments: 0, commentsWeek: 0 })).toBe('')
  })
  it('names each folder with its weekly count', () => {
    const text = describeSpamCounts({ forms: 3, formsWeek: 1, reviews: 1, reviewsWeek: 0, comments: 0, commentsWeek: 0 })
    expect(text).toContain('3 form entries (1 this week)')
    expect(text).toContain('1 product review (0 this week)')
    expect(text).not.toContain('comment')
  })
})
