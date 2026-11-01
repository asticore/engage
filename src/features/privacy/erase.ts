import type { D1Like } from '@/features/apiKeys'
import { anonymisedOrderPatch } from './core'
import { asEngine, commerceRecords, customerRecords, type EngineLike } from './data'

/**
 * The erasure. Runs in this order, so a failure part way leaves the request open for another try
 * (the admin can run it again; every step is safe to repeat):
 *   1. Orders: anonymised, never deleted (tax and accounting records keep the totals).
 *   2. Addresses: deleted.
 *   3. Carts: deleted (working data, not a record of sale).
 *   4. Product reviews: kept as shop content, with the reviewer's email and name removed.
 *   5. Sessions, API keys, passkeys, trusted devices, login and two-step codes: revoked and deleted.
 *   6. The customer record itself.
 *
 * Kept, untouched: form submissions and booking (event RSVP) entries. A form exists to keep what
 * people send, so those rows stay, and only staff with the right permission can read them (see the
 * access rules on the collections). Payment records and store credit (balance and movements) are
 * not touched either: they are money and accounting records.
 * Returns counts only, which is what the request keeps as its result.
 */

export type EraseCounts = Record<string, number>

async function runCount(d1: D1Like, sql: string, ...args: unknown[]): Promise<number> {
  const result = await d1
    .prepare(sql)
    .bind(...args)
    .run()
  return Number((result as unknown as { meta?: { changes?: number } }).meta?.changes ?? 0)
}

export async function eraseCustomerData(engine: unknown, d1: D1Like, userId: number, email: string): Promise<EraseCounts> {
  const e: EngineLike = asEngine(engine)
  const records = await customerRecords(e, d1, userId, email)
  const commerce = await commerceRecords(e, userId, email)
  const counts: EraseCounts = { orders: 0, addresses: 0, carts: 0, reviews: 0, sessions: 0, apiKeys: 0, passkeys: 0, trustedDevices: 0, loginTokens: 0, codes: 0, accountRecords: 0 }

  for (const order of records.orders) {
    await e.update({ collection: 'orders', id: order.id, data: anonymisedOrderPatch(), overrideAccess: true })
    counts.orders += 1
  }
  for (const address of records.addresses) {
    await e.delete({ collection: 'addresses', id: address.id, overrideAccess: true })
    counts.addresses += 1
  }
  for (const cart of commerce.carts) {
    await e.delete({ collection: 'carts', id: cart.id, overrideAccess: true })
    counts.carts += 1
  }
  for (const review of commerce.reviews) {
    await e.update({ collection: 'product-reviews', id: review.id, data: { name: 'Former customer', email: null }, overrideAccess: true })
    counts.reviews += 1
  }

  counts.sessions += await runCount(d1, 'DELETE FROM eg_user_sessions WHERE user_id = ?', userId)
  counts.apiKeys += await runCount(d1, 'DELETE FROM eg_api_keys WHERE user_id = ?', userId)
  counts.passkeys += await runCount(d1, 'DELETE FROM eg_passkeys WHERE user_id = ?', userId)
  counts.trustedDevices += await runCount(d1, 'DELETE FROM eg_trusted_devices WHERE user_id = ?', userId)
  counts.loginTokens += await runCount(d1, 'DELETE FROM eg_login_tokens WHERE user_id = ?', userId)
  counts.codes += await runCount(d1, 'DELETE FROM eg_two_factor_email_codes WHERE user_id = ?', userId)

  await e.delete({ collection: 'users', id: userId, overrideAccess: true })
  counts.accountRecords = 1
  return counts
}
