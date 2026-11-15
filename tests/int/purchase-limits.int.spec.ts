import { describe, expect, it } from 'vitest'

import { addressKey, normaliseEmail, parseRule, refusal, type Context } from '@/features/purchaseLimits/logic'

const now = new Date('2026-03-10T12:00:00Z')
const hoursAgo = (h: number): number => now.getTime() - h * 3_600_000
const ctx = (over: Partial<Context> = {}): Context => ({ productTitle: 'Tee', wantQty: 1, prior: [], verified: true, now, ...over })

describe('purchase limit rules', () => {
  it('sees one person behind email tricks and one address behind spelling', () => {
    expect(normaliseEmail(' Jo.Smith+shop@Gmail.com ')).toBe('josmith@gmail.com')
    expect(normaliseEmail('jo.smith@googlemail.com')).toBe('josmith@gmail.com')
    expect(normaliseEmail('a.b+x@example.com')).toBe('a.b@example.com')
    expect(addressKey('12 High St.', '4000')).toBe(addressKey('12 high st', ' 4000'))
    expect(addressKey('1', '4')).toBe('')
  })
  it('validates a rule', () => {
    expect(parseRule({ title: '' }).ok).toBe(false)
    expect(parseRule({ title: 'x' }).ok).toBe(false) // does nothing
    const ok = parseRule({ title: 'Two each', productId: '7', maxQty: '2', windowDays: '30' })
    expect(ok.ok && ok.value).toMatchObject({ productId: 7, maxQty: 2, windowDays: 30, cooldownHours: 0, active: true })
    expect(parseRule({ title: 'Verified', requireVerified: true }).ok).toBe(true)
  })
  it('refuses a second order over the limit and says how many are left', () => {
    const rule = { maxQty: 2, windowDays: 0, cooldownHours: 0, requireVerified: false }
    expect(refusal(rule, ctx({ wantQty: 2 }))).toBeNull()
    expect(refusal(rule, ctx({ wantQty: 2, prior: [{ qty: 1, atMs: hoursAgo(5) }] }))).toContain('1 more')
    expect(refusal(rule, ctx({ prior: [{ qty: 2, atMs: hoursAgo(5) }] }))).toContain('reached')
  })
  it('only counts orders inside the window', () => {
    const rule = { maxQty: 1, windowDays: 7, cooldownHours: 0, requireVerified: false }
    expect(refusal(rule, ctx({ prior: [{ qty: 1, atMs: hoursAgo(24 * 10) }] }))).toBeNull()
    expect(refusal(rule, ctx({ prior: [{ qty: 1, atMs: hoursAgo(24 * 2) }] }))).not.toBeNull()
  })
  it('holds a cooldown and a verified-account rule', () => {
    const cool = { maxQty: null as number | null, windowDays: 0, cooldownHours: 24, requireVerified: false }
    expect(refusal(cool, ctx({ prior: [{ qty: 1, atMs: hoursAgo(2) }] }))).toContain('again after')
    expect(refusal(cool, ctx({ prior: [{ qty: 1, atMs: hoursAgo(30) }] }))).toBeNull()
    const verified = { maxQty: null as number | null, windowDays: 0, cooldownHours: 0, requireVerified: true }
    expect(refusal(verified, ctx({ verified: false }))).toContain('verified')
    expect(refusal(verified, ctx())).toBeNull()
  })
})
