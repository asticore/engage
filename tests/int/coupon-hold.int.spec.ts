// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPlatformProxy } from 'wrangler'
import { consoleLogger } from '@/localapi/logger'
import { holdCouponUse } from '@/features/ecommerce/server/couponHold'

describe('coupon usage holds at checkout', () => {
  let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ D1: D1Database }>>>
  let db: never

  beforeAll(async () => {
    proxy = await getPlatformProxy<{ D1: D1Database }>({ persist: false })
    const d1 = proxy.env.D1
    await d1.prepare('CREATE TABLE eg_coupons (id integer primary key, code text not null, usage_count numeric, usage_limit numeric)').run()
    await d1.prepare('CREATE TABLE eg_orders (id integer primary key, cart_id numeric, status text)').run()
    await d1.prepare("INSERT INTO eg_coupons (code, usage_count, usage_limit) VALUES ('SAVE10', 0, 2)").run()
    const mod = await import('@/migrations/20270223_110000_coupon_reservations')
    const { drizzle } = await import('drizzle-orm/d1')
    await mod.up({ db: drizzle(d1) as never, engine: { logger: consoleLogger } } as never)
    await mod.up({ db: drizzle(d1) as never, engine: { logger: consoleLogger } } as never)
    db = d1 as never
  }, 120_000)

  afterAll(async () => {
    await proxy.dispose()
  })

  it('holds up to the limit, refuses the next cart, refreshes the same cart and frees a hold when its cart is paid', async () => {
    const now = new Date('2026-11-01T10:00:00.000Z')
    expect(await holdCouponUse(db, 'SAVE10', 101, 2, now)).toBe(true)
    expect(await holdCouponUse(db, 'SAVE10', 102, 2, now)).toBe(true)
    expect(await holdCouponUse(db, 'SAVE10', 103, 2, now)).toBe(false)
    // The same cart again refreshes its own hold rather than taking a second one.
    expect(await holdCouponUse(db, 'SAVE10', 101, 2, new Date(now.getTime() + 60_000))).toBe(true)
    // After 30 minutes both holds have run out.
    expect(await holdCouponUse(db, 'SAVE10', 103, 2, new Date(now.getTime() + 31 * 60_000))).toBe(true)
    // A paid order for cart 103 turns its hold into the paid use, so it stops counting as a hold.
    await (db as unknown as D1Database).prepare("INSERT INTO eg_orders (cart_id, status) VALUES (103, 'processing')").run()
    await (db as unknown as D1Database).prepare("UPDATE eg_coupons SET usage_count = 1 WHERE code = 'SAVE10'").run()
    expect(await holdCouponUse(db, 'SAVE10', 104, 2, new Date(now.getTime() + 31 * 60_000))).toBe(true)
  })

  it('answers null when there is no database, so the caller keeps its soft check', async () => {
    expect(await holdCouponUse(null, 'SAVE10', 1, 2)).toBeNull()
  })
})
