import { describe, expect, it } from 'vitest'

import { cancelRsvpsForOrder, createRsvpsForOrder, tierForLine } from '@/features/events/orderRsvps'
import { activeRsvps, stampCancellation } from '@/features/editScreens/rsvpStatus'
import { guestsByTier } from '@/features/editScreens/tierSales'
import { rsvpNeedsReminder } from '@/features/email/schedule'
import { verifyEventCapacity } from '@/hooks/checkEventCapacity'

type Doc = Record<string, unknown>

/** A tiny in-memory engine: equality and `in` filters only, which is all these paths use. */
function fakeEngine(data: Record<string, Doc[]>) {
  const matches = (doc: Doc, where: Record<string, { equals?: unknown; in?: unknown[] }> = {}) =>
    Object.entries(where).every(([key, rule]) => {
      const value = typeof doc[key] === 'object' && doc[key] ? (doc[key] as Doc).id : doc[key]
      if ('equals' in rule) return String(value) === String(rule.equals)
      if (rule.in) return rule.in.map(String).includes(String(value))
      return true
    })
  let next = 100
  return {
    data,
    async find({ collection, where }: { collection: string; where?: never }) {
      return { docs: (data[collection] ?? []).filter((d) => matches(d, where)) }
    },
    async findByID({ collection, id }: { collection: string; id: number }) {
      return (data[collection] ?? []).find((d) => d.id === id) ?? null
    },
    async create({ collection, data: row }: { collection: string; data: Doc }) {
      const doc = { id: next++, ...row }
      ;(data[collection] ??= []).push(doc)
      return doc
    },
    async update({ collection, id, data: patch }: { collection: string; id: number; data: Doc }) {
      const doc = data[collection].find((d) => d.id === id) as Doc
      Object.assign(doc, patch)
      return doc
    },
    async delete({ collection, id }: { collection: string; id: number }) {
      data[collection] = data[collection].filter((d) => d.id !== id)
      return {}
    },
  }
}

const tiers: Array<{ id: string; name: string; description: string; price: number; capacity: number | null; salesEnd: string | null }> = [
  { id: 'a', name: 'General', description: '', price: 10, capacity: null, salesEnd: null },
  { id: 'b', name: 'VIP', description: '', price: 40, capacity: 1, salesEnd: null },
]

describe('paid ticket bookings', () => {
  it('books one RSVP per ticket line and is safe to replay', async () => {
    const engine = fakeEngine({
      events: [{ id: 7, ticketProduct: 3, ticketTiers: tiers }],
      products: [{ id: 3, variations: [] }],
      'event-rsvps': [],
    })
    const order = { id: 55, customerEmail: 'a@b.test', shippingAddress: { firstName: 'Ana', lastName: 'Lee' }, lineItems: [{ productId: 3, quantity: 2, name: 'Gala - VIP' }, { productId: 9, quantity: 1, name: 'Mug' }] }
    const first = await createRsvpsForOrder(engine as never, order)
    expect(first.created).toBe(1)
    const row = engine.data['event-rsvps'][0]
    expect(row).toMatchObject({ event: 7, name: 'Ana Lee', email: 'a@b.test', guestCount: 2, ticketTier: 'VIP', orderId: 55, status: 'confirmed' })
    const again = await createRsvpsForOrder(engine as never, order)
    expect(again.created).toBe(0)
    expect(engine.data['event-rsvps']).toHaveLength(1)
  })

  it('ignores orders with no ticket product', async () => {
    const engine = fakeEngine({ events: [{ id: 7, ticketProduct: 3 }], 'event-rsvps': [] })
    const result = await createRsvpsForOrder(engine as never, { id: 1, customerEmail: 'a@b.test', lineItems: [{ productId: 9, quantity: 1 }] })
    expect(result.created).toBe(0)
  })

  it('a refund cancels the bookings and frees their places', async () => {
    const engine = fakeEngine({ 'event-rsvps': [{ id: 1, orderId: 55, ticketTier: 'VIP', guestCount: 1 }, { id: 2, orderId: 56, guestCount: 1 }] })
    expect(await cancelRsvpsForOrder(engine as never, 55)).toBe(1)
    expect(await cancelRsvpsForOrder(engine as never, 55)).toBe(0)
    const rows = engine.data['event-rsvps']
    expect(rows[0]).toMatchObject({ status: 'cancelled' })
    expect(rows[1].status).toBeUndefined()
    expect(guestsByTier(rows as never).get('VIP')).toBeUndefined()
    expect(activeRsvps(rows)).toHaveLength(1)
    expect(rsvpNeedsReminder({ id: 1, email: 'a@b.test', status: 'cancelled' } as never)).toBe(false)
  })

  it('matches a ticket type from the variation label or the line name', () => {
    expect(tierForLine(tiers, 'vip', '')).toBe('VIP')
    expect(tierForLine(tiers, null, 'Gala - General')).toBe('General')
    expect(tierForLine(tiers, 'Other', 'Gala')).toBeNull()
  })

  it('books a line on the ticket type that owns its product', async () => {
    const own: Array<{ id: string; name: string; description: string; price: number; capacity: number | null; salesEnd: string | null; productId: number }> = [
      { id: 'a', name: 'General', description: '', price: 10, capacity: null, salesEnd: null, productId: 11 },
      { id: 'b', name: 'VIP', description: '', price: 40, capacity: null, salesEnd: null, productId: 12 },
    ]
    expect(tierForLine(own as never, null, 'Gala', 12)).toBe('VIP')
    const engine = fakeEngine({ events: [{ id: 8, eventType: 'paid', ticketProduct: null, ticketTiers: own }], 'event-rsvps': [] })
    const order = { id: 60, customerEmail: 'a@b.test', lineItems: [{ productId: 12, quantity: 2, name: 'VIP pass' }, { productId: 99, quantity: 1, name: 'Mug' }] }
    const result = await createRsvpsForOrder(engine as never, order)
    expect(result.created).toBe(1)
    expect(engine.data['event-rsvps'][0]).toMatchObject({ event: 8, ticketTier: 'VIP', guestCount: 2 })
  })

  it('stamps and clears the cancellation time', async () => {
    const run = (data: Doc) => (stampCancellation as never as (a: { data: Doc }) => Promise<Doc>)({ data })
    expect((await run({ status: 'cancelled' })).cancelledAt).toBeTruthy()
    expect((await run({ status: 'confirmed', cancelledAt: 'x' })).cancelledAt).toBeNull()
  })
})

describe('capacity settles after the insert', () => {
  const run = (engine: ReturnType<typeof fakeEngine>, doc: Doc) =>
    (verifyEventCapacity as never as (a: unknown) => Promise<Doc>)({ doc, operation: 'create', req: { engine } })

  it('of two racing bookings the earlier stays and the later is removed', async () => {
    const engine = fakeEngine({
      events: [{ id: 1, capacity: 2, ticketTiers: [] }],
      'event-rsvps': [
        { id: 1, event: 1, guestCount: 1 },
        { id: 2, event: 1, guestCount: 1 },
        { id: 3, event: 1, guestCount: 1 },
      ],
    })
    await expect(run(engine, engine.data['event-rsvps'][0])).resolves.toBeTruthy()
    await expect(run(engine, engine.data['event-rsvps'][1])).resolves.toBeTruthy()
    await expect(run(engine, engine.data['event-rsvps'][2])).rejects.toThrow('capacity')
    expect(engine.data['event-rsvps'].map((r) => r.id)).toEqual([1, 2])
  })

  it('removes a booking that overfills its ticket type', async () => {
    const engine = fakeEngine({
      events: [{ id: 1, capacity: null, ticketTiers: tiers }],
      'event-rsvps': [
        { id: 1, event: 1, guestCount: 1, ticketTier: 'VIP' },
        { id: 2, event: 1, guestCount: 1, ticketTier: 'VIP' },
      ],
    })
    await expect(run(engine, engine.data['event-rsvps'][1])).rejects.toThrow('VIP is sold out')
    expect(engine.data['event-rsvps']).toHaveLength(1)
  })

  it('ignores cancelled bookings and paid bookings', async () => {
    const engine = fakeEngine({
      events: [{ id: 1, capacity: 1, ticketTiers: [] }],
      'event-rsvps': [
        { id: 1, event: 1, guestCount: 1, status: 'cancelled' },
        { id: 2, event: 1, guestCount: 1 },
      ],
    })
    await expect(run(engine, engine.data['event-rsvps'][1])).resolves.toBeTruthy()
    await expect(run(engine, { id: 9, event: 1, orderId: 5, guestCount: 4 })).resolves.toBeTruthy()
  })
})
