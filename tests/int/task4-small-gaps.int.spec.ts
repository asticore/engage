import { describe, expect, it } from 'vitest'

import { customerTypeList } from '@/features/ecommerce/server/customerTypes'
import { resolveTierPrice, variationTierNotes, type PriceTier } from '@/features/ecommerce/lib/priceTiers'
import { categoryUrl } from '@/features/categories/frontend'
import { resolvePath, type CategoryRow } from '@/features/categories/tree'
import { categoryTreeFields } from '@/lib/blockContextFrom'
import { resolveLoopMergeTags } from '@/features/siteTemplates/loopMergeTags'

const tier = (over: Partial<PriceTier>): PriceTier => ({ productId: '1', variationId: null, customerType: null, minQty: 10, price: 8, ...over }) as PriceTier

describe('wholesale tiers by company', () => {
  it('lists roles then company names and slugs without repeats', () => {
    expect(customerTypeList(['wholesale'], [{ name: 'Acme Pty', slug: 'acme-pty' }, { name: 'wholesale', slug: null }])).toEqual(['wholesale', 'Acme Pty', 'company:acme-pty'])
    expect(customerTypeList(undefined, [])).toEqual([])
  })
  it('a tier set for a company applies to its members', () => {
    const tiers = [tier({ customerType: 'acme pty', price: 7 })]
    const types = customerTypeList([], [{ name: 'Acme Pty', slug: 'acme' }])
    expect(resolveTierPrice(tiers, { productId: '1', variationId: null, quantity: 10, customerTypes: types, basePrice: 10 }).price).toBe(7)
    expect(resolveTierPrice(tiers, { productId: '1', variationId: null, quantity: 10, customerTypes: [], basePrice: 10 }).price).toBe(10)
  })
})

describe('variation tier notes', () => {
  it('lists only tiers that belong to one variation, with its label', () => {
    const tiers = [tier({ variationId: 'v1', minQty: 5, price: 9 }), tier({ variationId: null, minQty: 20, price: 7 })]
    const notes = variationTierNotes(tiers, { productId: '1', customerTypes: [] }, [{ id: 'v1', label: 'Red, M', price: 10 }, { id: 'v2', label: 'Blue', price: 10 }], (n) => `$${n}`)
    expect(notes).toEqual(['Red, M: Buy 5 or more: $9 each'])
  })
})

const rows: CategoryRow[] = [
  { id: 1, scope: 'blog', name: 'News', slug: 'news', parentId: null, sortOrder: 0 },
  { id: 2, scope: 'blog', name: 'Releases', slug: 'releases', parentId: 1, sortOrder: 0 },
]

describe('blog category tree paths and tags', () => {
  it('uses the full nested path and still resolves a bare slug', () => {
    expect(categoryUrl('blog', rows, 2)).toBe('/blog/category/news/releases')
    expect(resolvePath(rows, ['news', 'releases'])?.id).toBe(2)
    expect(resolvePath(rows, ['releases'])?.id).toBe(2)
    expect(resolvePath(rows, ['other', 'releases'])).toBeNull()
  })
  it('fills the tree tags from the first category name', () => {
    const fields = categoryTreeFields('releases', rows)
    expect(fields).toEqual({ categoryTrail: ['News', 'Releases'], categoryHref: '/blog/category/news/releases' })
    const item = { title: 'x', href: '/blog/x', categories: ['Releases'], ...fields }
    expect(resolveLoopMergeTags('{{category}} | {{category_path}} | {{category_url}}', item)).toBe('Releases | News > Releases | /blog/category/news/releases')
    expect(categoryTreeFields('Unknown', rows)).toEqual({})
  })
})
