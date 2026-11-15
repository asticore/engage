import { describe, expect, it } from 'vitest'

import { messagesFromPublicConfig, publicPaymentConfig } from '@/features/ecommerce/lib/paymentMethods'

const cfg = (settings: unknown, currency = 'AUD') => publicPaymentConfig(settings as never, currency)

describe('pay later messaging', () => {
  it('shows only when the method is on, messaging is on, and the currency and amount fit', () => {
    const on = cfg({ afterpay: { enabled: true, showMessaging: true } })
    expect(messagesFromPublicConfig(on, 10000, 'AU')).toEqual([expect.stringContaining('Afterpay')])
    expect(messagesFromPublicConfig(cfg({ afterpay: { enabled: true, showMessaging: true } }, 'JPY'), 10000, 'AU')).toEqual([])
    expect(messagesFromPublicConfig(on, 300000, 'AU')).toEqual([])
    expect(messagesFromPublicConfig(cfg({ afterpay: { enabled: false, showMessaging: true } }), 10000, 'AU')).toEqual([])
  })
  it('can be hidden with the setting', () => {
    expect(messagesFromPublicConfig(cfg({ klarna: { enabled: true, showMessaging: false } }), 10000, 'AU')).toEqual([])
  })
})
