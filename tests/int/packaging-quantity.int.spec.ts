import { describe, expect, it } from 'vitest'

import { resolveCartLine, type CatalogueProduct } from '@/features/ecommerce/catalogue'
import { renderInvoiceHtml, renderPackingSlipHtml } from '@/features/ecommerce/lib/invoice'
import { describeQuantity, normalizeQuantity, packagingError, packagingLimits, packagingStep } from '@/features/ecommerce/lib/packaging'
import { BASE_COLUMNS, exportProductsCsv, parseProductsCsv } from '@/features/ecommerce/csv'

const carton: CatalogueProduct = { id: 1, title: 'Bolts', productType: 'simple', priceInAUD: 2, manageStock: false, unitsPerCarton: 12, sellInMultiplesOf: 'carton' }

describe('carton and pallet quantities', () => {
  it('a product with 12 per carton cannot be added as 5', () => {
    expect(resolveCartLine(carton, null, 5)).toMatchObject({ ok: false })
    expect((resolveCartLine(carton, null, 5) as { error: string }).error).toMatch(/multiple of 12/)
    expect(resolveCartLine(carton, null, 24)).toMatchObject({ ok: true })
  })
  it('steps by the pallet when sold by the pallet, and falls back to the carton without a pallet size', () => {
    expect(packagingStep({ unitsPerCarton: 12, cartonsPerPallet: 10, sellInMultiplesOf: 'pallet' })).toBe(120)
    expect(packagingStep({ unitsPerCarton: 12, sellInMultiplesOf: 'pallet' })).toBe(12)
    expect(packagingStep({ unitsPerCarton: 12 })).toBe(1)
  })
  it('rounds up when the product asks for it', () => {
    expect(normalizeQuantity(5, { ...carton, roundUp: true })).toBe(12)
    expect(normalizeQuantity(13, { ...carton, roundUp: true })).toBe(24)
    expect(normalizeQuantity(5, carton)).toBe(5)
  })
  it('applies a minimum number of cartons', () => {
    const p = { unitsPerCarton: 12, sellInMultiplesOf: 'carton', minCartons: 3 }
    expect(packagingError(24, p)).toMatch(/at least 3 cartons \(36 units\)/)
    expect(packagingError(36, p)).toBeNull()
    expect(normalizeQuantity(1, { ...p, roundUp: true })).toBe(36)
    expect(packagingLimits(p, 1)).toEqual({ min: 36, step: 12 })
  })
  it('leaves ordinary products alone', () => {
    expect(packagingError(5, {})).toBeNull()
    expect(packagingLimits({}, 1)).toEqual({ min: 1, step: 1 })
  })
  it('words the line as cartons and units', () => {
    expect(describeQuantity(24, 12)).toBe('2 cartons (24 units)')
    expect(describeQuantity(12, 12)).toBe('1 carton (12 units)')
    expect(describeQuantity(5, null)).toBe('5')
  })
  it('shows cartons on the invoice and packing slip', () => {
    const order = { id: 1, lineItems: [{ name: 'Bolts', quantity: 24, cartonSize: 12, unitCents: 200, lineCents: 4800 }] } as never
    const store = { name: 'Shop' }
    expect(renderInvoiceHtml(order, store)).toContain('2 cartons (24 units)')
    expect(renderPackingSlipHtml(order, store)).toContain('2 cartons (24 units)')
  })
  it('exports and imports the packaging columns', () => {
    expect(BASE_COLUMNS).toContain('Units per carton')
    const csv = exportProductsCsv([{ id: 1, title: 'Bolts', slug: 'bolts', sku: 'B1', productType: 'simple', priceInAUD: 2, unitsPerCarton: 12, sellInMultiplesOf: 'carton', roundUp: true, minCartons: 2 }])
    expect(csv).toContain('Units per carton')
    const plan = parseProductsCsv(csv)
    expect(plan.errors).toEqual([])
    expect(plan.products[0].data).toMatchObject({ unitsPerCarton: 12, sellInMultiplesOf: 'carton', roundUp: true, minCartons: 2 })
  })
})
