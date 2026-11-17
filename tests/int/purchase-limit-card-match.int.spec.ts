// @vitest-environment node
import { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'

import { addressKey, normaliseEmail } from '@/features/purchaseLimits/logic'
import { fingerprintOf } from '@/features/purchaseLimits/cardPrint'
import * as store from '@/features/purchaseLimits/store'

/** A D1 look-alike over node:sqlite: prepare().bind().all()/run(). */
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

let db: DatabaseSync
const now = '2026-11-17T12:00:00.000Z'

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE eg_orders (id integer PRIMARY KEY, status text, created_at text, customer_email text, customer_id integer, shipping_address_address_line1 text, shipping_address_postal_code text, cart_id integer);
    CREATE TABLE eg_orders_items (id integer PRIMARY KEY, _parent_id integer, product_id integer, quantity integer);
    CREATE TABLE eg_purchase_card_prints (id integer PRIMARY KEY AUTOINCREMENT, order_id integer NOT NULL, fingerprint text NOT NULL, created_at text);
    CREATE UNIQUE INDEX fp_uq ON eg_purchase_card_prints (order_id, fingerprint);`)
  const order = (id: number, email: string, line1: string, qty: number, status = 'processing') => {
    db.prepare('INSERT INTO eg_orders VALUES (?,?,?,?,?,?,?,?)').run(id, status, '2026-11-10T00:00:00.000Z', email, null, line1, '4000', id)
    db.prepare('INSERT INTO eg_orders_items (_parent_id, product_id, quantity) VALUES (?,?,?)').run(id, 7, qty)
  }
  order(1, 'a@x.com', '1 First Street', 1)
  order(2, 'other@y.com', '99 Elsewhere Rd', 2) // same card as order 1, nothing else in common
  order(3, 'third@z.com', '5 Other Way', 4) // different card
  order(4, 'cancelled@y.com', '99 Elsewhere Rd', 3, 'cancelled')
})

const who = { emailKeys: ['a@x.com'], userId: null, addressKey: addressKey('1 First Street', '4000') }
const prior = () => store.priorPurchases(d1Over(db), 7, who, null, normaliseEmail, addressKey, 0)

describe('card fingerprint match', () => {
  it('counts only the buyer own orders when no card is recorded', async () => {
    expect((await prior()).map((p) => p.qty)).toEqual([1])
  })

  it('adds orders paid with the same card under another email and address', async () => {
    await store.recordCardPrint(d1Over(db), 1, 'fp_abc', now)
    await store.recordCardPrint(d1Over(db), 2, 'fp_abc', now)
    await store.recordCardPrint(d1Over(db), 3, 'fp_zzz', now)
    await store.recordCardPrint(d1Over(db), 4, 'fp_abc', now)
    expect((await prior()).map((p) => p.qty).sort()).toEqual([1, 2]) // order 3 is another card, order 4 is cancelled
  })

  it('records a card once per order and ignores an empty fingerprint', async () => {
    await store.recordCardPrint(d1Over(db), 1, 'fp_abc', now)
    await store.recordCardPrint(d1Over(db), 1, 'fp_abc', now)
    await store.recordCardPrint(d1Over(db), 1, '', now)
    expect(db.prepare('SELECT COUNT(*) AS n FROM eg_purchase_card_prints').get()).toEqual({ n: 1 })
  })

  it('still answers when the card table does not exist', async () => {
    db.exec('DROP TABLE eg_purchase_card_prints')
    expect((await prior()).map((p) => p.qty)).toEqual([1])
  })

  it('reads the fingerprint from a charge', () => {
    expect(fingerprintOf({ payment_method_details: { card: { fingerprint: ' fp_1 ' } } })).toBe('fp_1')
    expect(fingerprintOf({ payment_method_details: { type: 'paypal' } })).toBe('')
    expect(fingerprintOf(null)).toBe('')
    expect(fingerprintOf('ch_123')).toBe('')
  })
})
