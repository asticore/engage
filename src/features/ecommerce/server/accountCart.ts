import crypto from 'crypto'

import { mergeCartLines, mergeLine, GUEST_CART_DAYS, type CartLine, type GuestCartRef } from '../lib/guestCart'

/**
 * The signed-in shopper's cart, and the merge of a guest cart into it.
 *
 * Every sign-in and sign-up path ends in a page load, and the shop client asks `/api/shop-cart/session` on load.
 * That call lands here: a signed-in shopper gets one persistent cart (the same on every device), and a guest cart
 * that came with the browser is folded into it first. Nothing is lost on sign-in, and a refused line (stock or
 * limits) is counted so the cart page can say so.
 */

export type CartRow = {
  id: number
  secret?: string | null
  customer?: number | { id: number } | null
  items?: CartLine[] | null
  purchasedAt?: string | null
  currency?: string | null
}

export type AccountCartStore = {
  /** The guest cart for this id and secret. Null when it is gone, wrong, already owned by an account, or purchased. */
  findGuest: (ref: GuestCartRef) => Promise<CartRow | null>
  /** The account's unpurchased carts, newest first. */
  findAccountCarts: (userId: number) => Promise<CartRow[]>
  create: (data: { customer: number; secret: string; currency?: string | null; items: CartLine[] }) => Promise<CartRow>
  /** Saves lines or a secret. Throws when the cart rules refuse the lines (stock, limits). */
  update: (id: number, data: { items?: CartLine[]; secret?: string }) => Promise<CartRow>
  remove: (id: number) => Promise<void>
  newSecret: () => string
}

export type AccountCartResult = { id: number; secret: string; merged: number; skipped: number }

const customerId = (row: CartRow): number | null =>
  row.customer && typeof row.customer === 'object' ? row.customer.id : typeof row.customer === 'number' ? row.customer : null

/**
 * Finds or creates the account's cart and folds a guest cart into it. The cart rules re-check stock and limits on
 * every save, so a merged quantity the shop cannot supply is refused; then lines go in one at a time and a refused
 * line is skipped and counted. The guest cart is deleted once its lines are in.
 */
export async function resolveAccountCart(store: AccountCartStore, userId: number, guest: GuestCartRef | null): Promise<AccountCartResult> {
  const guestCart = guest ? await store.findGuest(guest).catch((): null => null) : null
  const owned = (await store.findAccountCarts(userId)).filter((cart) => customerId(cart) === userId && !cart.purchasedAt)
  let account = owned[0] ?? (await store.create({ customer: userId, secret: store.newSecret(), currency: guestCart?.currency ?? null, items: [] }))
  if (!account.secret) account = await store.update(account.id, { secret: store.newSecret() })

  let merged = 0
  let skipped = 0
  const guestLines = (guestCart?.items ?? []).filter((line) => (line.quantity ?? 0) > 0)
  if (guestCart && guestCart.id !== account.id && guestLines.length > 0) {
    const base = (account.items ?? []) as CartLine[]
    try {
      await store.update(account.id, { items: mergeCartLines(base, guestLines) })
      merged = guestLines.length
    } catch {
      let items = base
      for (const line of guestLines) {
        const next = mergeLine(items, line)
        try {
          await store.update(account.id, { items: next })
          items = next
          merged += 1
        } catch {
          skipped += 1
        }
      }
    }
  }
  if (guestCart && guestCart.id !== account.id) await store.remove(guestCart.id).catch((): undefined => undefined)
  return { id: account.id, secret: account.secret as string, merged, skipped }
}

/** The store over the real engine. Every call uses overrideAccess, because the caller has already proven who the person is. */
type EngineLike = {
  find: (args: Record<string, unknown>) => Promise<{ docs: unknown[] }>
  findByID: (args: Record<string, unknown>) => Promise<unknown>
  create: (args: Record<string, unknown>) => Promise<unknown>
  update: (args: Record<string, unknown>) => Promise<unknown>
  delete: (args: Record<string, unknown>) => Promise<unknown>
}

export const engineAccountCartStore = (engine: EngineLike): AccountCartStore => ({
  findGuest: async (ref) => {
    const doc = (await engine.findByID({ collection: 'carts', id: ref.id, depth: 0, overrideAccess: true }).catch((): null => null)) as CartRow | null
    if (!doc || doc.secret !== ref.secret || doc.purchasedAt || customerId(doc) !== null) return null
    return doc
  },
  findAccountCarts: async (userId) =>
    (await engine.find({ collection: 'carts', where: { customer: { equals: userId } }, sort: '-updatedAt', limit: 10, depth: 0, overrideAccess: true })).docs as CartRow[],
  create: async (data) => (await engine.create({ collection: 'carts', data, overrideAccess: true })) as CartRow,
  update: async (id, data) => (await engine.update({ collection: 'carts', id, data, overrideAccess: true })) as CartRow,
  remove: async (id) => {
    await engine.delete({ collection: 'carts', id, overrideAccess: true })
  },
  newSecret: () => crypto.randomBytes(20).toString('hex'),
})

/** Deletes guest carts nobody has touched for GUEST_CART_DAYS days. Bounded per run. Purchased carts and account carts stay. */
export async function sweepGuestCarts(engine: EngineLike, now: Date = new Date(), limit = 200): Promise<number> {
  const cutoff = new Date(now.getTime() - GUEST_CART_DAYS * 24 * 3_600_000).toISOString()
  const old = await engine.find({
    collection: 'carts',
    where: { and: [{ updatedAt: { less_than: cutoff } }, { customer: { exists: false } }, { purchasedAt: { exists: false } }] },
    limit,
    depth: 0,
    overrideAccess: true,
  })
  let removed = 0
  for (const cart of old.docs as CartRow[]) {
    if (customerId(cart) !== null || cart.purchasedAt) continue
    await engine.delete({ collection: 'carts', id: cart.id, overrideAccess: true })
    removed += 1
  }
  return removed
}
