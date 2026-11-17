import { describe, expect, it, vi } from 'vitest'

const sessionsCreate = vi.fn(async () => ({ url: 'https://pay.example/s_1' }))
vi.mock('@/features/ecommerce/payments/stripeAdapter', () => ({ getStripeClient: () => ({ checkout: { sessions: { create: sessionsCreate } } }) }))
vi.mock('@/features/ecommerce/payments/config', () => ({
  loadPaymentSettings: async () => ({ offline: {} }),
  resolveStripeSecret: (s: { key?: string }) => s.key ?? null,
}))
vi.mock('@/features/ecommerce/lib/shopCurrency', () => ({ loadShopCurrency: async () => 'aud' }))
vi.mock('@/features/ecommerce/server/emails', () => ({ sendAdminNewOrderEmail: async (): Promise<void> => undefined, sendOrderEmail: async (): Promise<void> => undefined }))
vi.mock('@/features/email', () => ({ sendEmail: async (): Promise<void> => undefined }))

import { acceptQuote } from '@/features/quotes/service'
import type { QuoteRequest } from '@/features/quotes/store'

const request = { id: 3, number: 'Q-3', status: 'quoted', email: 'a@b.test', currency: 'aud', validUntil: '2099-01-01T00:00:00Z', lines: [{ description: 'Logo', quantity: 2, unitCents: 5000 }], activity: [] } as unknown as QuoteRequest
const d1 = () => ({ prepare: () => ({ bind: () => ({ all: async () => ({ results: [] as unknown[] }), run: async () => ({ meta: { changes: 1 } }) }) }) })
const engine = (created: Record<string, unknown>[]) => ({
  create: async (a: Record<string, unknown>) => {
    created.push(a)
    return { id: 77 }
  },
  update: async (): Promise<void> => undefined,
  findByID: async () => ({ id: 77 }),
  findGlobal: async () => ({}),
})

describe('quote card payment', () => {
  it('refuses card payment when Stripe is not set up', async () => {
    const result = await acceptQuote(d1() as never, engine([]) as never, request, new Date('2026-11-17T00:00:00Z'), { origin: 'https://x.test', token: 't' })
    expect(result).toMatchObject({ ok: false, status: 409 })
  })
  it('creates a pending stripe order and a checkout session tied to it', async () => {
    vi.doMock('@/features/ecommerce/payments/config', () => ({ loadPaymentSettings: async () => ({ offline: {}, key: 'sk_test' }), resolveStripeSecret: (s: { key?: string }) => s.key ?? null }))
    vi.resetModules()
    const { acceptQuote: fresh } = await import('@/features/quotes/service')
    const created: Record<string, unknown>[] = []
    const result = await fresh(d1() as never, engine(created) as never, request, new Date('2026-11-17T00:00:00Z'), { origin: 'https://x.test', token: 'tok' })
    expect(result).toMatchObject({ ok: true, orderId: 77, payUrl: 'https://pay.example/s_1' })
    expect((created[0].data as { paymentMethod: string; amount: number }).paymentMethod).toBe('stripe')
    expect((created[0].data as { amount: number }).amount).toBe(10000)
    const args = (sessionsCreate.mock.calls as unknown as [Record<string, unknown>][])[0][0]
    expect(args.payment_intent_data).toEqual({ metadata: { orderID: '77' } })
    expect(args.success_url).toBe('https://x.test/quote/tok?paid=1')
  })
})
