import { describe, expect, it } from 'vitest'

import { checkSpamRules, countLinks, senderBlocked } from '@/features/forms/spamRules'

const none = { blockedWords: '', maxLinks: 0, blockedSenders: '' }

describe('form spam rules', () => {
  it('passes when no rule is set', () => {
    expect(checkSpamRules({ message: 'http://a.co http://b.co http://c.co' }, none).spam).toBe(false)
  })
  it('catches blocked words, any case', () => {
    expect(checkSpamRules({ message: 'Cheap CASINO deals' }, { ...none, blockedWords: 'casino\nviagra' }).spam).toBe(true)
    expect(checkSpamRules({ message: 'Hello' }, { ...none, blockedWords: 'casino' }).spam).toBe(false)
  })
  it('limits links across all fields', () => {
    const rules = { ...none, maxLinks: 2 }
    expect(checkSpamRules({ a: 'http://x.co', b: 'www.y.co' }, rules).spam).toBe(false)
    expect(checkSpamRules({ a: 'http://x.co', b: 'www.y.co http://z.co' }, rules).spam).toBe(true)
    expect(countLinks('see https://a.co')).toBe(1)
  })
  it('blocks senders by address or domain', () => {
    expect(senderBlocked('bot@spam.example', 'spam.example')).toBe(true)
    expect(senderBlocked('bot@mail.spam.example', 'spam.example')).toBe(true)
    expect(senderBlocked('x@notspam.example', 'spam.example')).toBe(false)
    expect(senderBlocked('bad@x.co', 'bad@x.co')).toBe(true)
    expect(senderBlocked('good@x.co', 'bad@x.co')).toBe(false)
    expect(checkSpamRules({ email: 'bot@spam.example' }, { ...none, blockedSenders: 'spam.example' }).spam).toBe(true)
  })
})
