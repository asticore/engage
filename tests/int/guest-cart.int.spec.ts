// @vitest-environment node
// Guest carts and the account cart (Task 23g guest accounts, 28a). The store is a small in-memory fake that
// refuses a line the way the cart rules refuse stock, so the merge fallbacks run against real behaviour.
import { describe, expect, it } from 'vitest'

import {
  GUEST_CART_COOKIE,
  GUEST_CART_DAYS,
  formatGuestCookie,
  mergeCartLines,
  parseGuestCookie,
  type CartLine,
} from '@/features/ecommerce/lib/guestCart'
import { resolveAccountCart, sweepGuestCarts, type AccountCartStore, type CartRow } from '@/features/ecommerce/server/accountCart'

const SECRET = 'a'.repeat(40)

const makeStore = (carts: CartRow[], stock: Record<number, number> = {}) => {
  let next = 100
  const removed: number[] = []
  const store: AccountCartStore = {
    findGuest: async (ref) => carts.find((c) => c.id === ref.id && c.secret === ref.secret && !c.customer && !c.purchasedAt) ?? null,
    findAccountCarts: async (userId) => carts.filter((c) => c.customer === userId),
    create: async (data) => {
      const row: CartRow = { id: next++, ...data }
      carts.push(row)
      return row
    },
    update: async (id, data) => {
      const row = carts.find((c) => c.id === id)!
      if (data.items) {
        for (const line of data.items) {
          const product = typeof line.product === 'number' ? line.product : 0
          if (product in stock && (line.quantity ?? 0) > stock[product]) throw new Error('not enough stock')
        }
        row.items = data.items
      }
      if (data.secret) row.secret = data.secret
      return row
    },
    remove: async (id) => {
      removed.push(id)
      const index = carts.findIndex((c) => c.id === id)
      if (index >= 0) carts.splice(index, 1)
    },
    newSecret: () => 'b'.repeat(40),
  }
  return { store, carts, removed }
}

describe('guest cart cookie', () => {
  it('round-trips and rejects anything else', () => {
    expect(parseGuestCookie(formatGuestCookie({ id: 12, secret: SECRET }))).toEqual({ id: 12, secret: SECRET })
    expect(GUEST_CART_COOKIE).toBe('eg_guest_cart')
    for (const bad of [undefined, '', '12', '0.' + SECRET, '-1.' + SECRET, '12.xyz', '12.' + 'g'.repeat(40), `12.${SECRET}.extra`, '1e3.' + SECRET]) {
      expect(parseGuestCookie(bad)).toBeNull()
    }
  })
})

describe('mergeCartLines', () => {
  it('adds quantities for the same product and variation and keeps different ones apart', () => {
    const merged = mergeCartLines(
      [{ id: 'x', product: 1, quantity: 2 }, { id: 'y', product: 2, variation: 'red', quantity: 1 }],
      [{ id: 'g1', product: 1, quantity: 3 }, { id: 'g2', product: 2, variation: 'blue', quantity: 1 }],
    )
    expect(merged).toEqual([
      { id: 'x', product: 1, quantity: 5 },
      { id: 'y', product: 2, variation: 'red', quantity: 1 },
      { product: 2, variation: 'blue', quantity: 1 },
    ])
  })

  it('never folds gift cards or custom amounts into another line, and drops the guest row id', () => {
    const merged = mergeCartLines([{ product: 3, quantity: 1, customAmount: 50 }], [{ id: 'g', product: 3, quantity: 1, customAmount: 50 }, { id: 'h', product: 4, quantity: 1, giftName: 'Sam' }])
    expect(merged).toHaveLength(3)
    expect(merged.every((line) => !('id' in line))).toBe(true)
  })

  it('treats populated product objects like ids', () => {
    expect(mergeCartLines([{ product: { id: 5 }, quantity: 1 }], [{ product: 5, quantity: 2 }])).toEqual([{ product: { id: 5 }, quantity: 3 }])
  })
})

describe('resolveAccountCart', () => {
  it('creates one account cart with a secret and merges the guest cart into it', async () => {
    const { store, carts, removed } = makeStore([{ id: 1, secret: SECRET, items: [{ id: 'g', product: 1, quantity: 2 }] }])
    const result = await resolveAccountCart(store, 7, { id: 1, secret: SECRET })
    expect(result).toEqual({ id: 100, secret: 'b'.repeat(40), merged: 1, skipped: 0 })
    expect(carts.find((c) => c.id === 100)?.items).toEqual([{ product: 1, quantity: 2 }])
    expect(removed).toEqual([1])
  })

  it('is stable across devices: the same account cart comes back, and a second guest cart adds to it', async () => {
    const { store, carts } = makeStore([
      { id: 5, customer: 7, secret: 'c'.repeat(40), items: [{ id: 'a', product: 1, quantity: 1 }] },
      { id: 6, secret: SECRET, items: [{ id: 'g', product: 1, quantity: 2 }] },
    ])
    expect((await resolveAccountCart(store, 7, null)).id).toBe(5)
    const result = await resolveAccountCart(store, 7, { id: 6, secret: SECRET })
    expect(result).toMatchObject({ id: 5, secret: 'c'.repeat(40), merged: 1, skipped: 0 })
    expect(carts.find((c) => c.id === 5)?.items?.[0].quantity).toBe(3)
    expect(carts.find((c) => c.id === 6)).toBeUndefined()
  })

  it('keeps the guest cart out of reach with a wrong secret, and ignores an account that already owns it', async () => {
    const { store, carts, removed } = makeStore([{ id: 1, secret: SECRET, items: [{ id: 'g', product: 1, quantity: 2 }] }, { id: 2, customer: 9, secret: SECRET, items: [{ id: 'z', product: 1, quantity: 1 }] }])
    expect(await resolveAccountCart(store, 7, { id: 1, secret: 'd'.repeat(40) })).toMatchObject({ merged: 0, skipped: 0 })
    expect(await resolveAccountCart(store, 7, { id: 2, secret: SECRET })).toMatchObject({ merged: 0, skipped: 0 })
    expect(removed).toEqual([])
    expect(carts.find((c) => c.id === 1)).toBeDefined()
    expect(carts.find((c) => c.id === 2)?.customer).toBe(9)
  })

  it('does not merge a guest cart that was already purchased', async () => {
    const { store, removed } = makeStore([{ id: 1, secret: SECRET, purchasedAt: '2026-11-01T00:00:00.000Z', items: [{ id: 'g', product: 1, quantity: 2 }] }])
    expect(await resolveAccountCart(store, 7, { id: 1, secret: SECRET })).toMatchObject({ merged: 0 })
    expect(removed).toEqual([])
  })

  it('rechecks stock: a line the shop cannot supply is skipped and counted, the rest still merge', async () => {
    const { store, carts } = makeStore(
      [
        { id: 5, customer: 7, secret: 'c'.repeat(40), items: [{ id: 'a', product: 1, quantity: 4 }] },
        { id: 6, secret: SECRET, items: [{ id: 'g1', product: 1, quantity: 3 }, { id: 'g2', product: 2, quantity: 1 }] },
      ],
      { 1: 5 },
    )
    const result = await resolveAccountCart(store, 7, { id: 6, secret: SECRET })
    expect(result).toMatchObject({ id: 5, merged: 1, skipped: 1 })
    expect(carts.find((c) => c.id === 5)?.items).toEqual([{ id: 'a', product: 1, quantity: 4 }, { product: 2, quantity: 1 }])
    expect(carts.find((c) => c.id === 6)).toBeUndefined()
  })

  it('gives an old account cart without a secret one', async () => {
    const { store } = makeStore([{ id: 5, customer: 7, items: [] }])
    expect(await resolveAccountCart(store, 7, null)).toMatchObject({ id: 5, secret: 'b'.repeat(40) })
  })

  it('leaves a purchased account cart behind and starts a fresh one', async () => {
    const { store } = makeStore([{ id: 5, customer: 7, secret: 'c'.repeat(40), purchasedAt: '2026-11-01T00:00:00.000Z', items: [] }])
    expect((await resolveAccountCart(store, 7, null)).id).toBe(100)
  })
})

describe('sweepGuestCarts', () => {
  it('asks for guest carts untouched for 30 days and deletes only those', async () => {
    const now = new Date('2026-12-01T00:00:00.000Z')
    const calls: Array<Record<string, unknown>> = []
    const deleted: number[] = []
    const engine = {
      find: async (args: Record<string, unknown>): Promise<{ docs: unknown[] }> => {
        calls.push(args)
        return { docs: [{ id: 1 }, { id: 2, customer: 4 }, { id: 3, purchasedAt: '2026-10-01T00:00:00.000Z' }] }
      },
      findByID: async (): Promise<null> => null,
      create: async (): Promise<null> => null,
      update: async (): Promise<null> => null,
      delete: async (args: Record<string, unknown>): Promise<void> => void deleted.push(args.id as number),
    }
    expect(await sweepGuestCarts(engine, now)).toBe(1)
    expect(deleted).toEqual([1])
    const cutoff = new Date(now.getTime() - GUEST_CART_DAYS * 24 * 3_600_000).toISOString()
    expect(JSON.stringify(calls[0].where)).toContain(cutoff)
    expect(JSON.stringify(calls[0].where)).toContain('"customer":{"exists":false}')
  })
})

describe('line type', () => {
  it('accepts the cart line shape the hooks use', () => {
    const line: CartLine = { product: 1, quantity: 1, addOns: null }
    expect(line.quantity).toBe(1)
  })
})
