import { describe, expect, it } from 'vitest'

import { runBookingReminders } from '@/features/bookings/reminders'
import { reminderEmail } from '@/features/bookings/service'
import type { Booking } from '@/features/bookings/store'

const booking = (id: number, startMs: number): Booking => ({
  id, number: `B${id}`, typeId: 1, resourceId: 1, status: 'confirmed', startAt: new Date(startMs).toISOString(), endAt: new Date(startMs + 1800000).toISOString(), startMs, endMs: startMs + 1800000, units: 1,
  timeZone: 'Australia/Brisbane', customerName: 'Sam', customerEmail: 's@example.com', customerPhone: '', notes: '', cancelledAt: null,
})

type Row = Record<string, unknown>
const rowOf = (b: Booking): Row => ({ id: b.id, number: b.number, type_id: 1, resource_id: 1, status: b.status, start_at: b.startAt, end_at: b.endAt, start_ms: b.startMs, end_ms: b.endMs, units: 1, time_zone: b.timeZone, customer_name: 'Sam', customer_email: 's@example.com', customer_phone: '', notes: '' })

describe('booking reminders', () => {
  it('writes a reminder with the time and number', () => {
    const mail = reminderEmail(booking(1, Date.UTC(2026, 10, 18, 1, 0)), 'Consult', 'Clinic')
    expect(mail.subject).toContain('Reminder: Consult')
    expect(mail.text).toContain('Booking number B1')
  })

  it('marks first and sends once per booking, and survives a bad send', async (): Promise<void> => {
    const now = new Date('2026-11-17T00:00:00Z')
    const rows = [rowOf(booking(1, now.getTime() + 3600000)), rowOf(booking(2, now.getTime() + 7200000))]
    const marked: unknown[] = []
    const d1 = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          all: async <T>(): Promise<{ results: T[] }> => ({ results: (sql.includes('reminder_sent_at IS NULL') ? rows : sql.includes('eg_booking_types') ? [{ id: 1, title: 'Consult', slug: 'c', description: '', active: 1 }] : []) as T[] }),
          run: async (): Promise<Record<string, never>> => {
            if (sql.includes('SET reminder_sent_at')) marked.push(args[1])
            return {}
          },
        }),
      }),
    }
    let calls = 0
    const sent = await runBookingReminders(d1, now, 'Clinic', async (): Promise<void> => {
      calls += 1
      if (calls === 1) throw new Error('smtp down')
    })
    expect(marked).toEqual([1, 2])
    expect(calls).toBe(2)
    expect(sent).toBe(1)
  })
})
