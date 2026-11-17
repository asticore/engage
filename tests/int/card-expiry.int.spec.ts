import { describe, expect, it, vi } from 'vitest'

import { daysUntilExpiry, shouldWarn, sweepCardExpiry } from '@/features/billing/cardExpiry'

vi.mock('@/features/email', () => ({ sendEmail: vi.fn(async (): Promise<boolean> => true) }))

const now = new Date('2026-11-17T03:00:00Z')

describe('card expiry warning', () => {
  it('counts to the end of the expiry month', () => {
    expect(daysUntilExpiry(11, 2026, now)).toBe(13)
    expect(shouldWarn(11, 2026, now)).toBe(true)
    expect(shouldWarn(12, 2026, now)).toBe(false)
    expect(shouldWarn(1, 2027, now)).toBe(false)
    expect(shouldWarn(10, 2026, now)).toBe(false)
  })

  it('warns once per expiry and writes the marker', async (): Promise<void> => {
    const updates: Record<string, unknown>[] = []
    const engine = {
      find: async (a: Record<string, unknown>): Promise<{ docs: unknown[] }> =>
        a.collection === 'product-subscriptions'
          ? { docs: [{ id: 7, stripeSubscriptionId: 'sub_1', customerEmail: 'a@example.com', productName: 'Coffee', history: [] }] }
          : { docs: [] },
      update: async (a: Record<string, unknown>): Promise<null> => {
        updates.push(a)
        return null
      },
    }
    const stripe = {
      subscriptions: { retrieve: async (): Promise<unknown> => ({ customer: 'cus_1', default_payment_method: { card: { exp_month: 11, exp_year: 2026 } } }) },
      billingPortal: { sessions: { create: async (): Promise<{ url: string }> => ({ url: 'https://portal.example/x' }) } },
    }
    const first = await sweepCardExpiry(engine, now, 'https://site.example', stripe as never)
    expect(first.warned).toBe(1)
    expect(JSON.stringify(updates[0])).toContain('Card expiry warning sent for 11/2026')
    const again = {
      ...engine,
      find: async (a: Record<string, unknown>): Promise<{ docs: unknown[] }> =>
        a.collection === 'product-subscriptions' ? { docs: [{ id: 7, stripeSubscriptionId: 'sub_1', customerEmail: 'a@example.com', history: [{ at: 'x', text: 'Card expiry warning sent for 11/2026.' }] }] } : { docs: [] },
    }
    expect((await sweepCardExpiry(again, now, 'https://site.example', stripe as never)).warned).toBe(0)
  })
})
