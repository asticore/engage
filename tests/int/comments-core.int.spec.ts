import { describe, expect, it } from 'vitest'

import { buildTree, cleanSettings, countLinks, decideStatus, DEFAULT_COMMENT_SETTINGS, hashAddress, hitsBlockedWord, initials, isClosed, validateComment, type PublicComment } from '@/features/comments/core'

const c = (id: number, parentId: number | null): PublicComment => ({ id, parentId, name: 'A', content: 'x', createdAt: '2026-01-01', fromTeam: false })

describe('comments core', () => {
  it('validates input', () => {
    expect(validateComment({ name: ' Sam ', email: 'SAM@x.com', content: ' hi ' })).toEqual({ ok: true, value: { name: 'Sam', email: 'sam@x.com', content: 'hi' } })
    expect(validateComment({ name: '', email: 'a@b.co', content: 'hi' }).ok).toBe(false)
    expect(validateComment({ name: 'a', email: 'nope', content: 'hi' }).ok).toBe(false)
    expect(validateComment({ name: 'a', email: 'a@b.co', content: '' }).ok).toBe(false)
    expect(validateComment({ name: 'a', email: 'a@b.co', content: 'x'.repeat(5000) }).ok).toBe(false)
  })
  it('cleans settings', () => {
    expect(cleanSettings(null)).toEqual(DEFAULT_COMMENT_SETTINGS)
    expect(cleanSettings({ mode: 'bad', maxDepth: 99, closeAfterDays: -1 })).toEqual(DEFAULT_COMMENT_SETTINGS)
    expect(cleanSettings({ mode: 'open', maxDepth: 2, closeAfterDays: 30, signedInAuto: true }).mode).toBe('open')
  })
  it('decides moderation', () => {
    const s = DEFAULT_COMMENT_SETTINGS
    expect(decideStatus(s, { content: 'hi', signedIn: false, hasApprovedBefore: true })).toBe('pending')
    expect(decideStatus({ ...s, mode: 'first' }, { content: 'hi', signedIn: false, hasApprovedBefore: true })).toBe('approved')
    expect(decideStatus({ ...s, mode: 'first' }, { content: 'hi', signedIn: false, hasApprovedBefore: false })).toBe('pending')
    expect(decideStatus({ ...s, mode: 'rules' }, { content: 'see http://x.co', signedIn: false, hasApprovedBefore: false })).toBe('pending')
    expect(decideStatus({ ...s, mode: 'rules' }, { content: 'plain', signedIn: false, hasApprovedBefore: false })).toBe('approved')
    expect(decideStatus({ ...s, mode: 'open' }, { content: 'hi', signedIn: false, hasApprovedBefore: false })).toBe('approved')
    expect(decideStatus({ ...s, signedInAuto: true }, { content: 'hi', signedIn: true, hasApprovedBefore: false })).toBe('approved')
  })
  it('finds blocked words and links', () => {
    expect(hitsBlockedWord('Buy CASINO now', 'casino\nviagra')).toBe(true)
    expect(hitsBlockedWord('hello', 'casino')).toBe(false)
    expect(hitsBlockedWord('hello', '')).toBe(false)
    expect(countLinks('http://a.co and www.b.co')).toBe(2)
  })
  it('closes after days', () => {
    const now = new Date('2026-03-01T00:00:00Z')
    expect(isClosed(0, '2020-01-01', now)).toBe(false)
    expect(isClosed(30, '2026-02-20', now)).toBe(false)
    expect(isClosed(30, '2026-01-01', now)).toBe(true)
    expect(isClosed(30, null, now)).toBe(false)
  })
  it('builds threads within depth', () => {
    const rows = [c(1, null), c(2, 1), c(3, 2), c(4, null)]
    const tree = buildTree(rows, 3)
    expect(tree.map((n) => n.id)).toEqual([1, 4])
    expect(tree[0].replies[0].replies[0].id).toBe(3)
    const flat = buildTree(rows, 1)
    expect(flat.map((n) => n.id).sort()).toEqual([1, 2, 3, 4])
    expect(flat.every((n) => n.replies.length === 0)).toBe(true)
  })
  it('makes initials and hashes addresses', async () => {
    expect(initials('sam smith jones')).toBe('SS')
    expect(initials('')).toBe('?')
    const h = await hashAddress('1.2.3.4', 's')
    expect(h).toMatch(/^[0-9a-f]{32}$/)
    expect(h).toBe(await hashAddress('1.2.3.4', 's'))
    expect(h).not.toContain('1.2.3.4')
  })
})

import { moderatorMailText } from '@/features/comments/moderatorMail'
describe('moderator email', () => {
  it('shortens long comments and links to the admin', () => {
    const m = moderatorMailText({ name: 'Ann', content: 'x'.repeat(400), postId: 7 }, 'https://s/admin/comments')
    expect(m.text).toContain('Ann commented on blog post #7')
    expect(m.text).toContain('...')
    expect(m.text).toContain('https://s/admin/comments')
  })
})
