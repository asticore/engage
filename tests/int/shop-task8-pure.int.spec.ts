import { describe, it, expect, vi } from 'vitest'
import { offlineEnabled, offlineMethodsFor, publicPaymentConfig } from '@/features/ecommerce/lib/paymentMethods'
import { parseBulkRequest, runBulk, tagIdsAfter, actionRefusal, type BulkPermissions } from '@/features/editScreens/bulk'
import { reviewLinksFor } from '@/features/ecommerce/server/emails'
import { brandName, fillLine, tagNames } from '@/features/ecommerce/lib/productTaxonomy'

const offline = { bankTransferEnabled: true, bankTransferDetails: '  BSB 000-000  ', chequeEnabled: false, chequeDetails: 'Payable to Shop', codEnabled: true, codDetails: 'Exact cash' }

describe('offline payment methods', () => {
  it('lists only the switched-on methods, in a fixed order, with trimmed instructions', () => {
    expect(offlineMethodsFor(offline)).toEqual([
      { id: 'bank-transfer', label: 'Bank transfer', instructions: 'BSB 000-000' },
      { id: 'cash-on-delivery', label: 'Cash on delivery', instructions: 'Exact cash' },
    ])
  })

  it('refuses a method that is off, unknown, or missing from the settings', () => {
    expect(offlineEnabled(offline, 'cheque')).toBe(false)
    expect(offlineEnabled(offline, 'crypto')).toBe(false)
    expect(offlineEnabled(undefined, 'bank-transfer')).toBe(false)
    expect(offlineEnabled(offline, 'bank-transfer')).toBe(true)
  })

  it('exposes the enabled methods to the storefront config without secrets', () => {
    const cfg = publicPaymentConfig({ offline }, 'AUD')
    expect(cfg.offline.map((m) => m.id)).toEqual(['bank-transfer', 'cash-on-delivery'])
    expect(publicPaymentConfig(null, 'AUD').offline).toEqual([])
  })
})

describe('bulk actions on products and orders', () => {
  it('accepts products and orders, and only offers each shop action on its own collection', () => {
    expect('error' in parseBulkRequest({ collection: 'products', ids: [1], action: 'trash' })).toBe(false)
    expect('error' in parseBulkRequest({ collection: 'orders', ids: [1], action: 'setStatus', status: 'completed' })).toBe(false)
    expect('error' in parseBulkRequest({ collection: 'orders', ids: [1], action: 'publish' })).toBe(true)
    expect('error' in parseBulkRequest({ collection: 'pages', ids: [1], action: 'setStatus', status: 'completed' })).toBe(true)
    expect('error' in parseBulkRequest({ collection: 'orders', ids: [1], action: 'setStatus', status: 'bogus' })).toBe(true)
    expect('error' in parseBulkRequest({ collection: 'products', ids: [1], action: 'addTag' })).toBe(true)
  })

  it('reads a brand of null or 0 as "no brand"', () => {
    const clear = parseBulkRequest({ collection: 'products', ids: [1], action: 'setBrand', brand: 0 })
    expect(clear.ok && clear.request.brand).toBeNull()
    const set = parseBulkRequest({ collection: 'products', ids: [1], action: 'setBrand', brand: '4' })
    expect(set.ok && set.request.brand).toBe(4)
  })

  it('adds and removes one tag id without touching the others', () => {
    expect(tagIdsAfter([1, { id: 2 }], 3, 'add')).toEqual([1, 2, 3])
    expect(tagIdsAfter([1, 2, 3], 2, 'remove')).toEqual([1, 3])
    expect(tagIdsAfter(null, 5, 'add')).toEqual([5])
  })

  it('needs the update permission for the shop actions', () => {
    const none: BulkPermissions = { isAdmin: false, update: false, publish: false, delete: false, editOthers: false }
    expect(actionRefusal('setStatus', none)).not.toBeNull()
    expect(actionRefusal('addTag', { ...none, update: true })).toBeNull()
  })

  it('changes a status only along an allowed transition and says why when refused', async () => {
    const orders: Record<number, { status: string }> = { 1: { status: 'pending' }, 2: { status: 'refunded' }, 3: { status: 'processing' } }
    const update = vi.fn(async () => ({}))
    const engine = { findByID: vi.fn(async ({ id }: { id: number }) => ({ id, ...orders[id] })), update, delete: vi.fn() }
    const results = await runBulk(engine as never, { id: 1 }, { collection: 'orders', ids: [1, 2, 3], action: 'setStatus', status: 'completed' })
    expect(results[0]).toEqual({ id: 1, ok: false, error: 'An order cannot move from "pending" to "completed".' })
    expect(results[1].ok).toBe(false)
    expect(results[2]).toEqual({ id: 3, ok: true })
    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ collection: 'orders', id: 3, data: { status: 'completed' } }))
  })

  it('writes the tag list and the brand on each product', async () => {
    const update = vi.fn(async () => ({}))
    const engine = { findByID: vi.fn(async ({ id }: { id: number }) => ({ id, tags: id === 1 ? [7] : [] })), update, delete: vi.fn() }
    await runBulk(engine as never, { id: 1 }, { collection: 'products', ids: [1, 2], action: 'addTag', tag: 7 })
    expect(update).toHaveBeenNthCalledWith(1, expect.objectContaining({ collection: 'products', id: 1, data: { tags: [7] } }))
    expect(update).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 2, data: { tags: [7] } }))
    await runBulk(engine as never, { id: 1 }, { collection: 'products', ids: [1], action: 'setBrand', brand: null })
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ data: { brand: null } }))
  })
})

describe('review links', () => {
  it('lists each reviewed product once, with a link when SITE_URL is set', () => {
    const order = { lineItems: [{ productId: 3 }, { productId: 3 }, { productId: 9 }, { productId: 4 }] }
    const bySlug = new Map([
      [3, { slug: 'candle', title: 'Candle' }],
      [9, { slug: 'soap', title: 'Soap' }],
    ])
    vi.stubEnv('SITE_URL', 'https://shop.example/')
    try {
      expect(reviewLinksFor(order, bySlug)).toBe('Candle: https://shop.example/shop/candle#reviews\nSoap: https://shop.example/shop/soap#reviews')
    } finally {
      vi.unstubAllEnvs()
    }
    expect(reviewLinksFor(order, bySlug)).toBe('Candle\nSoap')
  })
})

describe('brand and tags on the storefront', () => {
  it('reads the names of a populated brand and skips a brand that is only an id', () => {
    expect(brandName({ id: 2, name: ' Acme ' })).toBe('Acme')
    expect(brandName(7)).toBeNull()
    expect(brandName(null)).toBeNull()
    expect(brandName({ id: 2, name: '  ' })).toBeNull()
  })

  it('lists tag names in pick order, without repeats or unpopulated ids', () => {
    expect(tagNames([{ id: 1, name: 'Gift ideas' }, 5, { id: 2, name: 'Best sellers' }, { id: 1, name: 'Gift ideas' }])).toEqual(['Gift ideas', 'Best sellers'])
    expect(tagNames(undefined)).toEqual([])
  })

  it('fills the placeholder as plain text, even when the value holds $ patterns', () => {
    expect(fillLine('Brand: {name}', 'Acme')).toBe('Brand: Acme')
    expect(fillLine('Tags: {tags}', 'Price $& more')).toBe('Tags: Price $& more')
  })
})
