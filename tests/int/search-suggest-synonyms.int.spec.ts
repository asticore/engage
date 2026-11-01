/**
 * Site live search uses the shared synonyms: a query for "purchase" also finds
 * pages about orders, and the database query names the synonym words. Engine,
 * pages and password lookups are stubbed; nothing here reaches a real database.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const findMany = vi.fn()
const pages = vi.fn()

vi.mock('@/lib/engine', () => ({ getEngine: async (): Promise<unknown> => ({ find: (args: unknown): unknown => findMany(args) }) }))
vi.mock('@/utilities/features', () => ({ getFeatureFlags: async () => ({ blog: false, ecommerce: true, events: false }) }))
vi.mock('@/utilities/pagePaths', () => ({ getAllResolvedPages: (): unknown => pages() }))
vi.mock('@/cms/db/connect', () => ({ getDb: async () => ({}) }))
vi.mock('@/cms/db/contentPasswords', () => ({ getPasswordHash: async (): Promise<null> => null }))

import { findSuggestions } from '@/features/search/suggest'
import { searchTerms } from '@/features/search/synonyms'

describe('site search synonyms', () => {
  beforeEach(() => {
    findMany.mockReset()
    findMany.mockResolvedValue({ docs: [] })
    pages.mockReset()
    pages.mockReturnValue([
      { page: { id: 1, title: 'Your orders and returns', slug: 'orders', isHomepage: false, seo: null }, path: ['help', 'orders'] },
      { page: { id: 2, title: 'About us', slug: 'about', isHomepage: false, seo: null }, path: ['about'] },
    ])
  })

  it('a synonym query finds a page that names the synonym', async () => {
    const results = await findSuggestions('purchase')
    expect(results.map((r) => r.title)).toEqual(['Your orders and returns'])
  })

  it('product search asks the database for the synonym words too', async () => {
    await findSuggestions('2fa')
    const productCall = findMany.mock.calls.find(([args]) => (args as { collection: string }).collection === 'products')
    expect(productCall).toBeDefined()
    const where = JSON.stringify((productCall?.[0] as { where: unknown }).where)
    expect(where).toContain('two-step')
    expect(where).toContain('two-factor')
    expect(where).toContain('2fa')
  })

  it('keeps a plain query as it was: no synonym that the query does not reach', () => {
    expect(searchTerms('zzzz')).toEqual(['zzzz'])
    expect(searchTerms('purchase')).toEqual(expect.arrayContaining(['purchase', 'order', 'orders', 'invoice']))
  })
})
