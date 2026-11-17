// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/features/email', () => ({ sendEmail: vi.fn(async () => ({ ok: true })) }))

import { sendEmail } from '@/features/email'
import { loadHeldForOthers, markOfferPurchased, offerReleasedPlaces, sweepWaitingList } from '@/features/ecommerce/waitingList'

type Row = Record<string, unknown>
const now = new Date('2026-11-17T12:00:00Z')
const product = { id: 7, _status: 'published', title: 'Linen Shirt', slug: 'linen-shirt', manageStock: true, stockQty: 2, backorders: 'no' as const, variations: [] as never[] }

function fakeEngine(rows: Row[], mode: 'all' | 'ordered' = 'ordered') {
  return {
    findGlobal: async (args: { slug: string }) => (args.slug === 'shop-extra-settings' ? { waitingListMode: mode, waitingListHoldHours: 12 } : { storefront: {} }),
    findByID: async () => product,
    find: async (args: Record<string, unknown>) => {
      const where = args.where as { and?: Array<Record<string, unknown>>; status?: { equals: string } }
      const conds = where.and ?? [where as Record<string, unknown>]
      const docs = rows.filter((row) =>
        conds.every((cond) => {
          if ('product' in cond) return row.product === (cond.product as { equals: unknown }).equals
          if ('or' in cond) return (cond.or as Array<{ status: { equals: string } }>).some((o) => row.status === o.status.equals)
          if ('status' in cond) return row.status === (cond.status as { equals: string }).equals
          if ('holdUntil' in cond) return typeof row.holdUntil === 'string' && row.holdUntil < (cond.holdUntil as { less_than: string }).less_than
          return true
        }),
      )
      return { docs }
    },
    update: async (args: Record<string, unknown>) => {
      const row = rows.find((item) => item.id === args.id) as Row
      Object.assign(row, args.data as Row)
      return row
    },
  }
}

const wait = (id: number, email: string, extra: Row = {}): Row => ({ id, product: 7, variation: null, email, status: 'pending', createdAt: `2026-11-1${id}T00:00:00Z`, ...extra })

beforeEach(() => {
  vi.stubEnv('SITE_URL', 'https://example.com')
  vi.mocked(sendEmail).mockClear()
})

describe('waiting list service', () => {
  it('offers the two free places to the first two people, with a hold', async () => {
    const rows = [wait(1, 'a@x.com'), wait(2, 'b@x.com'), wait(3, 'c@x.com')]
    expect(await offerReleasedPlaces(fakeEngine(rows) as never, product as never, now)).toBe(2)
    expect(rows.map((r) => r.status)).toEqual(['offered', 'offered', 'pending'])
    expect(rows[0].holdUntil).toBe('2026-11-18T00:00:00.000Z')
    expect(sendEmail).toHaveBeenCalledTimes(2)
    // Running again offers nothing: both places are held.
    expect(await offerReleasedPlaces(fakeEngine(rows) as never, product as never, now)).toBe(0)
  })

  it('does nothing in email-everyone mode', async () => {
    const rows = [wait(1, 'a@x.com')]
    expect(await offerReleasedPlaces(fakeEngine(rows, 'all') as never, product as never, now)).toBe(0)
    expect(rows[0].status).toBe('pending')
  })

  it('holds places against other buyers but not the holder', async () => {
    const rows = [wait(1, 'a@x.com', { status: 'offered', holdUntil: '2026-11-18T00:00:00Z' })]
    const engine = fakeEngine(rows) as never
    expect((await loadHeldForOthers(engine, [{ product: 7 }], 'z@x.com', now)).get('7:')).toBe(1)
    expect((await loadHeldForOthers(engine, [{ product: 7 }], 'a@x.com', now)).size).toBe(0)
  })

  it('passes a lapsed hold to the next person', async () => {
    const rows = [wait(1, 'a@x.com', { status: 'offered', holdUntil: '2026-11-17T06:00:00Z' }), wait(2, 'b@x.com'), wait(3, 'c@x.com')]
    const product1 = { ...product, stockQty: 1 }
    const engine = { ...fakeEngine(rows), findByID: async () => product1 }
    expect(await sweepWaitingList(engine as never, now)).toBe(1)
    expect(rows.map((r) => r.status)).toEqual(['expired', 'offered', 'pending'])
  })

  it('marks an offered place purchased when that person buys', async () => {
    const rows = [wait(1, 'a@x.com', { status: 'offered', holdUntil: '2026-11-18T00:00:00Z' })]
    await markOfferPurchased(fakeEngine(rows) as never, 'A@x.com', [{ productId: 7, variationId: null }])
    expect(rows[0].status).toBe('purchased')
  })
})
