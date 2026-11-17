import { describe, expect, it } from 'vitest'

import { listBookingsByEmail } from '@/features/bookings/store'

describe('listBookingsByEmail', () => {
  it('matches on the lower-cased address and caps the limit', async (): Promise<void> => {
    const seen: unknown[][] = []
    const d1 = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => {
          seen.push([sql, ...args])
          return { all: async <T>(): Promise<{ results: T[] }> => ({ results: [] as T[] }), run: async (): Promise<Record<string, never>> => ({}) }
        },
      }),
    }
    expect(await listBookingsByEmail(d1, ' Sam@Example.COM ', 9999)).toEqual([])
    expect(seen[0][0]).toContain('lower(customer_email) = ?1')
    expect(seen[0][1]).toBe('sam@example.com')
    expect(seen[0][2]).toBe(200)
  })
})
