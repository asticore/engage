import { describe, expect, it } from 'vitest'

import { hashToken, hoursToText, isManageToken, newBookingNumber, newManageToken, parseCustomer, parseHoursText, parseOverride, parseResourceInput, parseTypeInput, slugOf } from '@/features/bookings/logic'
import { cancelError } from '@/features/bookings/service'

describe('bookings input rules', () => {
  it('reads weekly hours text, including day ranges and wrapping ranges', () => {
    const r = parseHoursText('mon-fri 09:00-12:00\nsat 10:00-14:00')
    expect(r.ok && r.rules.map((x) => x.weekday)).toEqual([1, 2, 3, 4, 5, 6])
    const wrap = parseHoursText('fri-mon 09:00-10:00')
    expect(wrap.ok && wrap.rules.map((x) => x.weekday)).toEqual([5, 6, 0, 1])
    expect(parseHoursText('monday 9-5').ok).toBe(false)
    expect(parseHoursText('mon 17:00-09:00').ok).toBe(false)
    const back = parseHoursText('tue 09:00-12:00\ntue 13:00-17:00')
    expect(back.ok && hoursToText(back.rules)).toBe('tue 09:00-12:00\ntue 13:00-17:00')
    expect(parseHoursText('').ok).toBe(true)
  })
  it('validates a booking type', () => {
    expect(parseTypeInput({ title: '' }).ok).toBe(false)
    const ok = parseTypeInput({ title: ' Haircut & Style ', durationMinutes: '45', capacity: 0, maxAdvanceDays: 9999 })
    expect(ok.ok && ok.value).toMatchObject({ title: 'Haircut & Style', slug: 'haircut-style', durationMinutes: 45, capacity: 1, maxAdvanceDays: 60, active: true })
    expect(slugOf('Café Visit!')).toBe('cafe-visit')
  })
  it('validates one-off changes and the customer', () => {
    expect(parseOverride({ date: '2026-02-30', kind: 'closed' }).ok).toBe(false)
    expect(parseOverride({ date: '2026-03-02', kind: 'open' }).ok).toBe(false)
    expect(parseOverride({ date: '2026-03-02', kind: 'closed', start: '13:00', end: '12:00' }).ok).toBe(false)
    expect(parseOverride({ date: '2026-03-02', kind: 'closed' }).ok).toBe(true)
    expect(parseCustomer({ name: '', email: 'a@b.co' }).ok).toBe(false)
    expect(parseCustomer({ name: 'Ada', email: 'nope' }).ok).toBe(false)
    const c = parseCustomer({ name: ' Ada ', email: ' ADA@Example.com ' })
    expect(c.ok && c.value).toMatchObject({ name: 'Ada', email: 'ada@example.com' })
    expect(parseResourceInput({ title: 'Room', timeZone: 'Not/AZone' }).ok).toBe(false)
    expect(parseResourceInput({ title: 'Room', timeZone: 'Australia/Brisbane' }).ok).toBe(true)
  })
  it('makes private links that only their hash can match', async () => {
    const token = newManageToken()
    expect(isManageToken(token)).toBe(true)
    expect(isManageToken('abc')).toBe(false)
    expect(await hashToken(token)).toHaveLength(64)
    expect(await hashToken(token)).not.toBe(token)
    expect(newBookingNumber()).toMatch(/^BK-[0-9A-Z]{6}$/)
  })
  it('lets a customer cancel only a confirmed booking that has not started', () => {
    const now = new Date('2026-03-01T00:00:00Z')
    const base = { id: 1, number: 'BK-1', typeId: 1, resourceId: 1, status: 'confirmed' as const, startAt: '', endAt: '', startMs: now.getTime() + 3_600_000, endMs: 0, units: 1, timeZone: 'UTC', customerName: '', customerEmail: '', customerPhone: '', notes: '', cancelledAt: null as string | null, amountCents: 0, paymentIntentId: null as string | null, paidAt: null as string | null, refundedCents: 0, createdAtMs: 0 }
    expect(cancelError(base, now)).toBeNull()
    expect(cancelError({ ...base, startMs: now.getTime() - 1 }, now)).toContain('started')
    expect(cancelError({ ...base, status: 'cancelled' }, now)).toContain('already')
    expect(cancelError({ ...base, status: 'completed' }, now)).toContain('no longer')
  })
})
