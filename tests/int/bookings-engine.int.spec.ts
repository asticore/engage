import { describe, expect, it } from 'vitest'

import { datesFrom, DEFAULT_RULES, minutesOf, slotsForDate, windowsFor, winsSlot, type Override, type Rule } from '@/features/bookings/engine'

const week: Rule[] = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: '09:00', end: '12:00' }))
const rules = { ...DEFAULT_RULES, durationMinutes: 60, stepMinutes: 60, minNoticeMinutes: 0, maxAdvanceDays: 365 }
const early = new Date('2026-01-01T00:00:00Z')

describe('booking slot engine', () => {
  it('reads times', () => {
    expect(minutesOf('09:30')).toBe(570)
    expect(minutesOf('24:00')).toBe(1440)
    expect(minutesOf('25:00')).toBeNull()
    expect(minutesOf('nope')).toBeNull()
  })
  it('uses weekly hours and skips days with none', () => {
    expect(windowsFor('2026-03-02', week, [])).toEqual([[540, 720]]) // Monday
    expect(windowsFor('2026-03-01', week, [])).toEqual([]) // Sunday
    expect(slotsForDate('2026-03-02', 'Australia/Brisbane', week, [], rules, [], early).map((s) => s.local)).toEqual(['09:00', '10:00', '11:00'])
  })
  it('applies closed days, part-day closures and extra open days', () => {
    const closed: Override[] = [{ date: '2026-03-02', kind: 'closed' }]
    expect(windowsFor('2026-03-02', week, closed)).toEqual([])
    const lunch: Override[] = [{ date: '2026-03-02', kind: 'closed', start: '10:00', end: '11:00' }]
    expect(windowsFor('2026-03-02', week, lunch)).toEqual([[540, 600], [660, 720]])
    const saturday: Override[] = [{ date: '2026-03-07', kind: 'open', start: '10:00', end: '12:00' }]
    expect(windowsFor('2026-03-07', week, saturday)).toEqual([[600, 720]])
  })
  it('fits the duration inside the window', () => {
    const long = { ...rules, durationMinutes: 90, stepMinutes: 30 }
    expect(slotsForDate('2026-03-02', 'Australia/Brisbane', week, [], long, [], early).map((s) => s.local)).toEqual(['09:00', '09:30', '10:00', '10:30'])
  })
  it('removes booked times, with buffers, and respects capacity', () => {
    const [, second] = slotsForDate('2026-03-02', 'Australia/Brisbane', week, [], rules, [], early)
    const busy = [{ startMs: second.startMs, endMs: second.endMs, units: 1 }]
    expect(slotsForDate('2026-03-02', 'Australia/Brisbane', week, [], rules, busy, early).map((s) => s.local)).toEqual(['09:00', '11:00'])
    const buffered = { ...rules, bufferAfterMinutes: 15 }
    // A 10:00 booking plus a 15 minute buffer after the candidate also blocks 09:00 (its buffer reaches 10:15).
    expect(slotsForDate('2026-03-02', 'Australia/Brisbane', week, [], buffered, busy, early).map((s) => s.local)).toEqual(['11:00'])
    const two = { ...rules, capacity: 2 }
    expect(slotsForDate('2026-03-02', 'Australia/Brisbane', week, [], two, busy, early)).toHaveLength(3)
    expect(slotsForDate('2026-03-02', 'Australia/Brisbane', week, [], two, [...busy, ...busy], early)).toHaveLength(2)
  })
  it('applies minimum notice and the booking window', () => {
    const now = new Date('2026-03-01T23:30:00Z') // Monday 09:30 in Brisbane
    const notice = { ...rules, minNoticeMinutes: 60 }
    expect(slotsForDate('2026-03-02', 'Australia/Brisbane', week, [], notice, [], now).map((s) => s.local)).toEqual(['11:00'])
    const near = { ...rules, maxAdvanceDays: 1 }
    expect(slotsForDate('2026-03-09', 'Australia/Brisbane', week, [], near, [], now)).toEqual([])
  })
  it('keeps wall-clock hours across a daylight saving change', () => {
    // Sydney clocks go back on Sunday 5 April 2026. Monday 6 April is UTC+10, Friday 3 April is UTC+11.
    const fri = slotsForDate('2026-04-03', 'Australia/Sydney', week, [], rules, [], early)[0]
    const mon = slotsForDate('2026-04-06', 'Australia/Sydney', week, [], rules, [], early)[0]
    expect(fri.local).toBe('09:00')
    expect(fri.start).toBe('2026-04-02T22:00:00.000Z')
    expect(mon.local).toBe('09:00')
    expect(mon.start).toBe('2026-04-05T23:00:00.000Z')
    // London goes forward on Sunday 29 March 2026.
    expect(slotsForDate('2026-03-27', 'Europe/London', week, [], rules, [], early)[0].start).toBe('2026-03-27T09:00:00.000Z')
    expect(slotsForDate('2026-03-30', 'Europe/London', week, [], rules, [], early)[0].start).toBe('2026-03-30T08:00:00.000Z')
  })
  it('lists dates', () => {
    expect(datesFrom('2026-02-27', 3)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01'])
    expect(datesFrom('bad', 3)).toEqual([])
  })
  it('lets only the first rows up to capacity keep the slot', () => {
    expect(winsSlot(5, [{ id: 5, units: 1 }], 1)).toBe(true)
    expect(winsSlot(6, [{ id: 5, units: 1 }, { id: 6, units: 1 }], 1)).toBe(false)
    expect(winsSlot(5, [{ id: 5, units: 1 }, { id: 6, units: 1 }], 1)).toBe(true)
    expect(winsSlot(6, [{ id: 5, units: 1 }, { id: 6, units: 1 }], 2)).toBe(true)
    expect(winsSlot(9, [{ id: 5, units: 1 }], 2)).toBe(false)
  })
})
