// @vitest-environment node
import { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/features/ecommerce/server/pricing', () => ({
  CheckoutError: class CheckoutError extends Error {},
}))
vi.mock('@/features/ecommerce/server/db', () => ({ rawD1: async (): Promise<null> => null }))
vi.mock('@/utilities/features', () => ({ getFeatureFlags: async () => ({ limits: true }) }))

import { checkRules, type LimitCheck } from '@/features/purchaseLimits/enforce'
import type { Rule } from '@/features/purchaseLimits/logic'
import { resetRateLimiter } from '@/features/security/rateLimit'
import type * as store from '@/features/purchaseLimits/store'

/** A D1 look-alike over node:sqlite. Each call is one step, so concurrent callers interleave between steps. */
function d1Over(db: DatabaseSync): store.D1 {
  return {
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => ({
        all: async <T>() => ({ results: db.prepare(sql).all(...(args as never[])) as T[] }),
        run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...(args as never[])).changes) } }),
      }),
    }),
  } as unknown as store.D1
}

const rule: Rule = { id: 1, title: 'One each', productId: 7, maxQty: 1, windowDays: 0, cooldownHours: 0, requireVerified: false, active: true, message: '', exemptEmails: '' }
const now = new Date('2026-11-17T12:00:00Z')
const check = (cartId: number, email = 'a@x.com', line1 = '1 First Street'): LimitCheck => ({ lines: [{ productId: 7, name: 'Tee', quantity: 1 }], email, user: null, address: { addressLine1: line1, postalCode: '4000' }, cartId })
const attempt = (d1: store.D1, c: LimitCheck) => checkRules(d1, [rule], c, now).then(() => 'passed', (): string => 'refused')

let db: DatabaseSync

beforeEach(() => {
  resetRateLimiter() // the buy-step throttle allows 20 tries a minute per person
  db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE eg_orders (id integer PRIMARY KEY, status text, created_at text, customer_email text, customer_id integer, shipping_address_address_line1 text, shipping_address_postal_code text, cart_id integer);
    CREATE TABLE eg_orders_items (id integer PRIMARY KEY, _parent_id integer, product_id integer, quantity integer);
    CREATE TABLE eg_purchase_card_prints (id integer PRIMARY KEY AUTOINCREMENT, order_id integer NOT NULL, fingerprint text NOT NULL, created_at text);
    CREATE TABLE eg_purchase_limit_blocks (id integer PRIMARY KEY AUTOINCREMENT, rule_id integer, product_id integer, reason text, email_key text, detail text, created_at text);
    CREATE TABLE eg_purchase_limit_claims (id integer PRIMARY KEY AUTOINCREMENT, cart_id integer NOT NULL, product_id integer NOT NULL, email_key text NOT NULL DEFAULT '', user_id integer, address_key text NOT NULL DEFAULT '', qty integer NOT NULL DEFAULT 1, created_at text, expires_at text NOT NULL);
    CREATE UNIQUE INDEX claims_uq ON eg_purchase_limit_claims (cart_id, product_id);`)
})

describe('two orders for the last allowed place', () => {
  it('never lets both pass, however the two interleave', async () => {
    const d1 = d1Over(db)
    for (let round = 0; round < 8; round++) {
      db.exec('DELETE FROM eg_purchase_limit_claims')
      const results = await Promise.all([attempt(d1, check(100 + round * 2)), attempt(d1, check(101 + round * 2))])
      expect(results.filter((r) => r === 'passed').length).toBeLessThanOrEqual(1)
    }
  })

  it('refuses the second order when it comes after the first has claimed', async () => {
    const d1 = d1Over(db)
    expect(await attempt(d1, check(1))).toBe('passed')
    expect(await attempt(d1, check(2, 'A@x.com'))).toBe('refused') // same person, other cart
    expect(await attempt(d1, check(1))).toBe('passed') // the first cart can retry (its claim is replaced)
  })

  it('frees the place when a refused order lets go, and when the claim expires', async () => {
    const d1 = d1Over(db)
    expect(await attempt(d1, check(1))).toBe('passed')
    expect(await attempt(d1, check(2))).toBe('refused')
    db.exec("UPDATE eg_purchase_limit_claims SET expires_at = '2026-11-17T11:00:00.000Z'")
    expect(await attempt(d1, check(2))).toBe('passed')
  })

  it('does not count a claim twice once the cart has an order', async () => {
    const d1 = d1Over(db)
    expect(await attempt(d1, check(1))).toBe('passed')
    db.prepare('INSERT INTO eg_orders VALUES (1, ?, ?, ?, NULL, ?, ?, 1)').run('processing', '2026-11-17T12:00:30.000Z', 'a@x.com', '1 First Street', '4000')
    db.prepare('INSERT INTO eg_orders_items (_parent_id, product_id, quantity) VALUES (1, 7, 1)').run()
    // The order itself now uses the one place; a second cart is refused by the order, not by a stale claim.
    expect(await attempt(d1, check(2))).toBe('refused')
    // A different person is not affected.
    expect(await attempt(d1, check(3, 'other@y.com', '99 Elsewhere Road'))).toBe('passed')
  })

  it('without claims the old read-then-write race lets both through (why the claim exists)', async () => {
    db.exec('DROP TABLE eg_purchase_limit_claims')
    const d1 = d1Over(db)
    const results = await Promise.all([attempt(d1, check(1)), attempt(d1, check(2))])
    expect(results).toEqual(['passed', 'passed'])
  })
})
