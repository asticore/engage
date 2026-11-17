import { describe, expect, it, vi } from 'vitest'

import { runAuctionSweep } from '@/features/quotes/auctions'
import { auctionWinner, bidRefusal } from '@/features/quotes/logic'

vi.mock('@/features/email', () => ({ sendEmail: vi.fn(async (): Promise<boolean> => true) }))

const now = new Date('2026-11-17T00:00:00Z')

describe('bid rules', () => {
  it('refuses low and late offers', () => {
    const open = { minimumCents: 5000, endsAt: '2026-11-18T00:00:00Z' }
    expect(bidRefusal(open, 4000, now)).toContain('lowest offer')
    expect(bidRefusal(open, 5000, now)).toBeNull()
    expect(bidRefusal({ minimumCents: 0, endsAt: '2026-11-16T00:00:00Z' }, 9000, now)).toContain('closed')
    expect(bidRefusal({ minimumCents: 0, endsAt: null }, 1, now)).toBeNull()
  })
  it('the highest offer wins and the earliest of a tie', () => {
    expect(auctionWinner([{ id: 3, offerCents: 5000 }, { id: 1, offerCents: 7000 }, { id: 2, offerCents: 7000 }])).toBe(1)
    expect(auctionWinner([])).toBeNull()
    expect(auctionWinner([{ id: 1, offerCents: null }])).toBeNull()
  })
})

const bidRow = (id: number, cents: number): Record<string, unknown> => ({ id, number: `Q${id}`, kind: 'bid', status: 'new', product_id: 9, name: 'Sam', email: `s${id}@example.com`, phone: '', quantity: 1, details: '', deadline: '', offer_cents: cents, currency: 'AUD', quote_lines: '[]', valid_until: null, terms: '', counter_note: '', activity: '[]', created_at: '2026-11-10T00:00:00Z' })

describe('auction sweep', () => {
  it('quotes the winner and declines the rest once the end time passed', async (): Promise<void> => {
    const rows = [bidRow(1, 6000), bidRow(2, 8000), bidRow(3, 7000)]
    const writes: string[] = []
    const d1 = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          all: async <T>(): Promise<{ results: T[] }> => {
            if (sql.includes('DISTINCT product_id')) return { results: [{ product_id: 9 }] as T[] }
            if (sql.includes('FROM eg_products')) return { results: [{ title: 'Vase', bid_minimum: 0, bid_ends_at: '2026-11-16T00:00:00Z' }] as T[] }
            if (sql.includes("kind = 'bid' AND status = 'new' AND product_id")) return { results: rows as T[] }
            if (sql.includes('WHERE id = ?1')) return { results: rows.filter((r) => r.id === args[0]) as T[] }
            return { results: [] as T[] }
          },
          run: async (): Promise<{ meta: { changes: number } }> => {
            writes.push(sql)
            return { meta: { changes: 1 } }
          },
        }),
      }),
    }
    const engine = { findGlobal: async (): Promise<null> => null }
    const result = await runAuctionSweep(d1, engine, now, 'https://shop.example')
    expect(result).toEqual({ won: 1, lost: 2 })
    expect(writes.filter((w) => w.includes("status = 'quoted'")).length).toBe(1)
  })

  it('leaves auctions that have not ended', async (): Promise<void> => {
    const d1 = {
      prepare: (sql: string) => ({
        bind: () => ({
          all: async <T>(): Promise<{ results: T[] }> => ({ results: (sql.includes('DISTINCT product_id') ? [{ product_id: 9 }] : sql.includes('FROM eg_products') ? [{ title: 'Vase', bid_minimum: 0, bid_ends_at: '2026-12-01T00:00:00Z' }] : []) as T[] }),
          run: async (): Promise<{ meta: { changes: number } }> => ({ meta: { changes: 0 } }),
        }),
      }),
    }
    expect(await runAuctionSweep(d1, { findGlobal: async (): Promise<null> => null }, now, 'https://shop.example')).toEqual({ won: 0, lost: 0 })
  })
})
