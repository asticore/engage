import { describe, expect, it } from 'vitest'

import { checkEmail, isDisposable, suggestEmail } from '@/features/security/emailCheck'

describe('email check', () => {
  it('spots disposable domains and subdomains', () => {
    expect(isDisposable('a@mailinator.com')).toBe(true)
    expect(isDisposable('A@Sub.Mailinator.com')).toBe(true)
    expect(isDisposable('a@gmail.com')).toBe(false)
    expect(isDisposable('nope')).toBe(false)
  })
  it('only blocks when switched on', () => {
    expect(checkEmail('a@yopmail.com', { blockDisposable: false }).ok).toBe(true)
    const v = checkEmail('a@yopmail.com', { blockDisposable: true })
    expect(v.ok).toBe(false)
    if (v.ok === false) expect(v.message).toContain('permanent')
  })
  it('suggests typo fixes', () => {
    expect(suggestEmail('sam@gmial.com')).toBe('sam@gmail.com')
    expect(suggestEmail('sam@gmail.com')).toBeNull()
  })
})
