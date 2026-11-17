import { describe, expect, it } from 'vitest'

import { resolveCartLine, type CatalogueProduct } from '@/features/ecommerce/catalogue'
import { heldForOthers, normaliseWaitingListSettings, pickOffers, placesFor, type WaitRow } from '@/features/ecommerce/lib/waitingList'

const now = new Date('2026-11-17T12:00:00Z')
const later = '2026-11-18T12:00:00Z'
const earlier = '2026-11-17T11:00:00Z'
const row = (id: number, email: string, extra: Partial<WaitRow> = {}): WaitRow => ({ id, email, status: 'pending', createdAt: `2026-11-1${id}T00:00:00Z`, ...extra })

describe('waiting list settings', () => {
  it('defaults to emailing everyone and clamps the hold', () => {
    expect(normaliseWaitingListSettings(undefined)).toEqual({ mode: 'all', holdHours: 24 })
    expect(normaliseWaitingListSettings({ waitingListMode: 'ordered', waitingListHoldHours: 6 })).toEqual({ mode: 'ordered', holdHours: 6 })
    expect(normaliseWaitingListSettings({ waitingListMode: 'ordered', waitingListHoldHours: 99999 }).holdHours).toBe(336)
    expect(normaliseWaitingListSettings({ waitingListMode: 'nonsense', waitingListHoldHours: 0 })).toEqual({ mode: 'all', holdHours: 24 })
  })
})

describe('pickOffers', () => {
  it('offers one place per free place, first sign-up first', () => {
    const rows = [row(3, 'c@x.com'), row(1, 'a@x.com'), row(2, 'b@x.com')]
    expect(pickOffers(rows, '', 2, now).map((r) => r.id)).toEqual([1, 2])
  })
  it('does not count a place that is already held', () => {
    const rows = [row(1, 'a@x.com', { status: 'offered', holdUntil: later }), row(2, 'b@x.com'), row(3, 'c@x.com')]
    expect(pickOffers(rows, '', 2, now).map((r) => r.id)).toEqual([2])
    expect(pickOffers(rows, '', 1, now)).toEqual([])
  })
  it('passes a lapsed hold to the next in line', () => {
    const rows = [row(1, 'a@x.com', { status: 'offered', holdUntil: earlier }), row(2, 'b@x.com')]
    expect(pickOffers(rows, '', 1, now).map((r) => r.id)).toEqual([2])
  })
  it('offers one person once and keeps variations apart', () => {
    const rows = [row(1, 'a@x.com'), row(2, 'A@x.com'), row(3, 'b@x.com', { variation: 'v1' })]
    expect(pickOffers(rows, '', 5, now).map((r) => r.id)).toEqual([1])
    expect(pickOffers(rows, 'v1', 5, now).map((r) => r.id)).toEqual([3])
  })
})

describe('held places', () => {
  const rows = [row(1, 'a@x.com', { status: 'offered', holdUntil: later }), row(2, 'b@x.com', { status: 'offered', holdUntil: earlier }), row(3, 'c@x.com', { status: 'pending' })]
  it('counts live holds for other people only', () => {
    expect(heldForOthers(rows, '', 'someone@x.com', now)).toBe(1)
    expect(heldForOthers(rows, '', 'a@x.com', now)).toBe(0)
    expect(heldForOthers(rows, 'v1', 'someone@x.com', now)).toBe(0)
  })
  it('reads places from the variation or the product', () => {
    expect(placesFor(null, { manageStock: true, stockQty: 3 })).toBe(3)
    expect(placesFor({ manageStock: true, stockQty: 1 }, { manageStock: true, stockQty: 3 })).toBe(1)
    expect(placesFor(null, { manageStock: true, stockQty: -2 })).toBe(0)
    expect(placesFor(null, { manageStock: false, stockStatus: 'outofstock' })).toBe(0)
  })
})

describe('checkout leaves held places free', () => {
  const product: CatalogueProduct = { productType: 'simple', priceInAUD: 10, manageStock: true, stockQty: 2, backorders: 'no' }
  it('refuses a buyer who would take a held place', () => {
    expect(resolveCartLine(product, null, 1, now, 0, null, true, 1).ok).toBe(true)
    expect(resolveCartLine(product, null, 2, now, 0, null, true, 1).ok).toBe(false)
    expect(resolveCartLine(product, null, 2, now, 0, null, true, 0).ok).toBe(true)
  })
  it('ignores holds on backorder and unmanaged stock', () => {
    expect(resolveCartLine({ ...product, backorders: 'yes' }, null, 2, now, 0, null, true, 2).ok).toBe(true)
    expect(resolveCartLine({ ...product, manageStock: false }, null, 2, now, 0, null, true, 2).ok).toBe(true)
  })
})
