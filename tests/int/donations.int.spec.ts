import { describe, expect, it } from 'vitest'

import { resolveCartLine } from '@/features/ecommerce/catalogue'
import { ANONYMOUS_ADD_ON_ID, checkDonationMax, donationLine, donationReceipt, donationView, parseAmounts, withDonationAddOns } from '@/features/ecommerce/lib/donations'

const product = { id: 1, title: 'Give', productType: 'simple', isDonation: true, minPrice: 5, donationMax: 500, donationAmounts: '10, 25, 50, 1000, abc, 25', donationCampaign: ' Flood relief ', donationAnonymous: true, donationReceiptText: 'ABN 12 345 678 901. Tax deductible.' } as never

describe('donations', () => {
  it('reads suggested amounts within the maximum, once each', () => {
    expect(parseAmounts('10, 25, $50, 1000, abc, 25', 500)).toEqual([10, 25, 50])
    expect(parseAmounts(null)).toEqual([])
    expect(donationView(product)).toMatchObject({ amounts: [10, 25, 50], max: 500, campaign: 'Flood relief', anonymous: true })
    expect(donationView({ isDonation: false } as never)).toBeNull()
  })
  it('adds the anonymous tick box only when offered', () => {
    expect(withDonationAddOns(product, []).map((d) => d.id)).toEqual([ANONYMOUS_ADD_ON_ID])
    expect(withDonationAddOns({ isDonation: true } as never, [])).toEqual([])
    expect(withDonationAddOns({} as never, [])).toEqual([])
  })
  it('accepts an amount in range and refuses too little or too much', () => {
    expect(resolveCartLine(product, null, 1, new Date(), 0, 2500, false)).toMatchObject({ ok: true, unitPrice: 25 })
    expect(resolveCartLine(product, null, 1, new Date(), 0, 100, false)).toMatchObject({ ok: false })
    expect(resolveCartLine(product, null, 1, new Date(), 0, 60000, false)).toMatchObject({ ok: false, error: expect.stringContaining('largest donation') })
    expect(resolveCartLine(product, null, 1, new Date(), 0, null, false)).toMatchObject({ ok: false })
    expect(checkDonationMax(50001, product)).not.toBeNull()
    expect(checkDonationMax(50000, product)).toBeNull()
  })
  it('keeps campaign and receipt wording on the order line', () => {
    expect(donationLine(product)).toEqual({ campaign: 'Flood relief', receiptText: 'ABN 12 345 678 901. Tax deductible.' })
    expect(donationLine({} as never)).toBeNull()
  })
  it('writes one receipt for the donation lines of an order', () => {
    const lines = [
      { name: 'Give', lineCents: 2500, donation: donationLine(product), addOns: [{ id: ANONYMOUS_ADD_ON_ID }] },
      { name: 'Give', lineCents: 1000, donation: donationLine(product), addOns: [] },
      { name: 'Mug', lineCents: 900 },
    ]
    const text = donationReceipt(lines, (c) => `$${(c / 100).toFixed(2)}`)
    expect(text).toContain('donation of $25.00 to Flood relief (given anonymously).')
    expect(text).toContain('donation of $10.00 to Flood relief.')
    expect(text.match(/Tax deductible/g)?.length).toBe(1)
    expect(donationReceipt([{ name: 'Mug', lineCents: 900 }], () => '')).toBe('')
  })
})
