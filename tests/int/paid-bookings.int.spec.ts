import { describe, expect, it } from 'vitest'

import { HOLD_MINUTES, holdActive, parseTypeInput, refundCentsFor } from '@/features/bookings/logic'
import { onBookingPaid, releaseExpiredHolds } from '@/features/bookings/payment'
import type { Booking } from '@/features/bookings/store'

const now = new Date('2026-11-17T00:00:00Z')

describe('paid booking rules', () => {
  it('refunds in full only when the cancel is early enough', () => {
    const start = now.getTime() + 48 * 3_600_000
    expect(refundCentsFor({ amountCents: 5000, refundedCents: 0, refundHours: 24, startMs: start, now })).toBe(5000)
    expect(refundCentsFor({ amountCents: 5000, refundedCents: 0, refundHours: 72, startMs: start, now })).toBe(0)
    expect(refundCentsFor({ amountCents: 5000, refundedCents: 5000, refundHours: 24, startMs: start, now })).toBe(0)
    expect(refundCentsFor({ amountCents: 0, refundedCents: 0, refundHours: 24, startMs: start, now })).toBe(0)
  })

  it('holds a time for the hold window', () => {
    expect(holdActive(now.getTime() - (HOLD_MINUTES - 1) * 60_000, now)).toBe(true)
    expect(holdActive(now.getTime() - (HOLD_MINUTES + 1) * 60_000, now)).toBe(false)
  })

  it('reads price and refund window from the type form', () => {
    const parsed = parseTypeInput({ title: 'Consult', priceCents: 8000, refundHours: 48 })
    expect(parsed.ok && parsed.value.priceCents).toBe(8000)
    expect(parsed.ok && parsed.value.refundHours).toBe(48)
    const free = parseTypeInput({ title: 'Chat' })
    expect(free.ok && free.value.priceCents).toBe(0)
    expect(free.ok && free.value.refundHours).toBe(24)
  })
})

const row = (id: number, status: string, createdAt: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id, number: `B${id}`, type_id: 1, resource_id: 1, status, start_at: 'x', end_at: 'y', start_ms: now.getTime() + 86_400_000, end_ms: now.getTime() + 90_000_000, units: 1, time_zone: 'UTC', customer_name: 'Sam', customer_email: 's@example.com', customer_phone: '', notes: '', amount_cents: 5000, created_at: createdAt, ...extra,
})

const fakeD1 = (rows: Record<string, unknown>[], log: unknown[][]) => ({
  prepare: (sql: string) => ({
    bind: (...args: unknown[]) => ({
      all: async <T>(): Promise<{ results: T[] }> => ({ results: (sql.includes("status = 'pending_payment'") ? rows.filter((r) => r.status === 'pending_payment') : sql.includes('WHERE id = ?1') ? rows.filter((r) => r.id === args[0]) : []) as T[] }),
      run: async (): Promise<{ meta: { changes: number } }> => {
        log.push([sql, ...args])
        return { meta: { changes: sql.includes("status = 'confirmed'") ? 1 : 0 } }
      },
    }),
  }),
})

describe('paid booking flow', () => {
  it('releases only holds that ran out', async (): Promise<void> => {
    const log: unknown[][] = []
    const rows = [row(1, 'pending_payment', new Date(now.getTime() - 60 * 60_000).toISOString()), row(2, 'pending_payment', new Date(now.getTime() - 5 * 60_000).toISOString())]
    expect(await releaseExpiredHolds(fakeD1(rows, log), now)).toBe(1)
    expect(log.some((l) => l[3] === 1 || l.includes(1))).toBe(true)
  })

  it('ignores a payment with no booking id and a replay on a confirmed booking', async (): Promise<void> => {
    const engine = { findGlobal: async (): Promise<null> => null, find: async (): Promise<{ docs: never[] }> => ({ docs: [] }) }
    const d1 = fakeD1([row(5, 'confirmed', now.toISOString(), { payment_intent_id: 'pi_1' })], [])
    expect(await onBookingPaid(d1, engine, { id: 'pi_1', amount_received: 5000, metadata: {} }, 'https://x.example', now)).toBe('unknown')
    expect(await onBookingPaid(d1, engine, { id: 'pi_1', amount_received: 5000, metadata: { bookingId: '5' } }, 'https://x.example', now)).toBe('already')
  })
})
