import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { brandKey, brandOptionsOf, productTaxonomyMatches, tagNames, tagOptionsOf } from '@/features/ecommerce/lib/productTaxonomy'
import { filterArchiveItems, NO_ARCHIVE_FILTERS } from '@/features/siteTemplates/archiveFilter'

type Row = Record<string, unknown>
type Where = Record<string, unknown>

const { mockEngine } = vi.hoisted(() => ({
  mockEngine: { find: vi.fn(), findGlobal: vi.fn() },
}))

vi.mock('@/features/organizations/visibility', () => ({ orgGateLocked: async () => false, listOrgRestrictedIdsLive: async () => new Set<number>() }))
vi.mock('@/lib/engine', () => ({ getEngine: vi.fn(async () => mockEngine) }))
vi.mock('@/features/visibility/excludeProtected', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/visibility/excludeProtected')>()),
  excludeProtected: async (_c: string, docs: unknown[]) => docs,
}))

import SearchPage from '@/app/(frontend)/search/page'

const ACME = { id: 1, name: 'Acme Atelier', slug: 'acme-atelier' }
const PRODUCTS: Row[] = [
  { id: 20, title: 'Grace candle', slug: 'grace-candle', _status: 'published', brand: ACME, tags: [{ id: 5, name: 'Gift Ideas' }, { id: 6, name: 'Winter' }] },
  { id: 21, title: 'Linen tote', slug: 'linen-tote', _status: 'published', brand: { id: 2, name: 'Field Co' }, tags: [{ id: 5, name: 'gift ideas' }] },
  { id: 22, title: 'Copper pot', slug: 'copper-pot', _status: 'published', brand: ACME, tags: [] },
  { id: 23, title: 'Acme gift card', slug: 'acme-gift-card', _status: 'published', brand: null, tags: [] },
  { id: 24, title: 'Hidden acme', slug: 'hidden-acme', _status: 'draft', brand: ACME, tags: [] },
]

/** The subset of the Where syntax the search page sends: and, or, equals and contains. */
function matches(row: Row, where: Where): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'and') return (value as Where[]).every((part) => matches(row, part))
    if (key === 'or') return (value as Where[]).some((part) => matches(row, part))
    return Object.entries(value as Record<string, unknown>).every(([operator, operand]) => {
      const field = row[key]
      if (operator === 'equals') return field === operand
      if (operator === 'contains') return typeof field === 'string' && field.toLowerCase().includes(String(operand).toLowerCase())
      throw new Error(`unsupported operator ${operator}`)
    })
  })
}

const COLLECTIONS: Record<string, Row[]> = { pages: [], posts: [], products: PRODUCTS, events: [] }

beforeEach(() => {
  vi.clearAllMocks()
  mockEngine.findGlobal.mockImplementation(async () => ({ features: { blog: false, ecommerce: true, events: false } }))
  mockEngine.find.mockImplementation(async (args: { collection: string; where?: Where; limit?: number }) => {
    const rows = COLLECTIONS[args.collection] ?? []
    const matched = args.where ? rows.filter((row) => matches(row, args.where as Where)) : rows
    const limit = args.limit && args.limit > 0 ? args.limit : matched.length
    return { docs: matched.slice(0, limit), totalDocs: matched.length }
  })
})

const render = async (params: Record<string, string>) =>
  renderToStaticMarkup((await SearchPage({ searchParams: Promise.resolve(params) })) as React.ReactElement)

describe('brand and tag helpers', () => {
  it('keys a brand by the slug of its name and reads names from populated objects only', () => {
    expect(brandKey(ACME)).toBe('acme-atelier')
    expect(brandKey(7)).toBeNull()
    expect(brandKey(null)).toBeNull()
  })

  it('lists each brand and tag once, by name, from the products', () => {
    expect(brandOptionsOf(PRODUCTS).map((b) => b.name)).toEqual(['Acme Atelier', 'Field Co'])
    expect(tagOptionsOf(PRODUCTS).map((t) => t.slug)).toEqual(['gift-ideas', 'winter'])
    expect(tagNames([{ id: 1 }, { name: ' Winter ' }, { name: 'Winter' }])).toEqual(['Winter'])
  })

  it('matches a product by brand or tag name, case-insensitively, and ignores blank queries', () => {
    expect(productTaxonomyMatches(PRODUCTS[0], 'ACME')).toBe(true)
    expect(productTaxonomyMatches(PRODUCTS[1], 'gift')).toBe(true)
    expect(productTaxonomyMatches(PRODUCTS[1], 'copper')).toBe(false)
    expect(productTaxonomyMatches(PRODUCTS[0], '  ')).toBe(false)
  })
})

describe('tag filter on the product list', () => {
  it('keeps products carrying the tag, comparing slugs', () => {
    const pool = PRODUCTS.map((p) => ({ title: String(p.title), excerpt: '', price: null as unknown, date: null as unknown, categories: [] as string[], tags: tagNames(p.tags), id: p.id as number }))
    const kept = filterArchiveItems(pool, { ...NO_ARCHIVE_FILTERS, tag: 'Gift Ideas' })
    expect(kept.map((k) => k.id)).toEqual([20, 21])
  })
})

describe('site search by brand and tag', () => {
  it('finds products by brand name and by tag name, once each, and skips drafts', async () => {
    const html = await render({ q: 'acme' })
    expect(html).toContain('Grace candle')
    expect(html).toContain('Copper pot')
    expect(html).toContain('Acme gift card')
    expect(html.match(/Acme gift card/g)?.length).toBe(1)
    expect(html).not.toContain('Hidden acme')
    expect(html).toContain('3 results for &quot;acme&quot;')

    const tagged = await render({ q: 'gift ideas' })
    expect(tagged).toContain('Grace candle')
    expect(tagged).toContain('Linen tote')
    expect(tagged).toContain('2 results for')
  })

  it('reads brand and tags at depth 1 for the taxonomy scan', async () => {
    await render({ q: 'winter' })
    const scan = mockEngine.find.mock.calls.find(([args]) => (args as { collection: string; depth?: number }).collection === 'products' && (args as { depth?: number }).depth === 1)
    expect(scan).toBeDefined()
  })
})
