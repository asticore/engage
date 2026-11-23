import { describe, expect, it } from 'vitest'

import { archiveQueryString, filterArchiveItems, isArchiveFilterActive, NO_ARCHIVE_FILTERS, parseArchiveFilters } from '@/features/siteTemplates/archiveFilter'

const items = [
  { title: 'A', price: 10, inStock: true, onSale: false, rating: 4.5 },
  { title: 'B', price: 20, inStock: false, onSale: true, rating: 3 },
  { title: 'C', price: 30, inStock: true, onSale: true, rating: null },
]

describe('archive filter: stock, sale and rating (34e)', () => {
  it('reads the new params and ignores bad ones', () => {
    expect(parseArchiveFilters({ instock: '1', onsale: '1', rating: '4' })).toMatchObject({ inStock: true, onSale: true, rating: 4 })
    expect(parseArchiveFilters({ instock: 'yes', rating: '9' })).toMatchObject({ inStock: false, rating: null })
  })
  it('filters and combines with price', () => {
    const f = (p: Record<string, string>) => filterArchiveItems(items, parseArchiveFilters(p)).map((i) => i.title)
    expect(f({ instock: '1' })).toEqual(['A', 'C'])
    expect(f({ onsale: '1' })).toEqual(['B', 'C'])
    expect(f({ rating: '4' })).toEqual(['A'])
    expect(f({ instock: '1', onsale: '1', max: '25' })).toEqual([])
  })
  it('round trips through the query string and counts as active', () => {
    const f = parseArchiveFilters({ instock: '1', rating: '3', q: 'x' })
    expect(archiveQueryString(f)).toBe('?q=x&instock=1&rating=3')
    expect(isArchiveFilterActive(f)).toBe(true)
    expect(isArchiveFilterActive(NO_ARCHIVE_FILTERS)).toBe(false)
  })
})
