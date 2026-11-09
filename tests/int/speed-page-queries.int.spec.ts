/**
 * Database reads per public page request (Task 12, speed).
 *
 * Each page's data loaders run twice in one request: generateMetadata and the
 * page itself. React's per-request `cache()` makes the second run free on the
 * server, but the client build of React runs `cache()` as a pass-through, so
 * this spec swaps in a small per-request memo to match the server behaviour.
 * `startRequest()` clears it, as a new request would.
 *
 * The upper bounds are the reads a page is allowed to make in total (its
 * metadata plus its body) with the sample site below. A new read on a public
 * page raises a count and fails here; lower the bound when a read goes away.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockEngine, memo, startRequest } = vi.hoisted(() => {
  const memo = new Map<unknown, Map<string, unknown>>()
  return {
    memo,
    startRequest: () => memo.clear(),
    mockEngine: { find: vi.fn(), findGlobal: vi.fn() },
  }
})

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    cache: (fn: (...args: unknown[]) => unknown) => (...args: unknown[]) => {
      let perFn = memo.get(fn)
      if (!perFn) {
        perFn = new Map()
        memo.set(fn, perFn)
      }
      const key = JSON.stringify(args)
      if (!perFn.has(key)) perFn.set(key, fn(...args))
      return perFn.get(key)
    },
  }
})
// These modules import Next's `server-only` marker, which Vitest does not resolve outside Next. They are
// only reached through the admin and tracking chain, which these pages never use at render time.
vi.mock('@/admin/i18n/serverUi', () => ({ getAdminUi: async (): Promise<Record<string, never>> => ({}) }))
vi.mock('@/features/tracking/editor/domainContext', () => ({ trackingDomainContext: async (): Promise<null> => null }))
vi.mock('@/features/tracking/apiGate', () => ({ trackingApiGate: async (): Promise<null> => null }))
vi.mock('@/features/tracking/adminAccess', () => ({ isSignedInTrackingAdmin: async (): Promise<boolean> => false }))
vi.mock('next/headers', () => ({
  headers: async (): Promise<Headers> => new Headers({ host: 'shop.example' }),
  cookies: async (): Promise<{ get: () => undefined; getAll: () => unknown[]; has: () => boolean }> => ({
    get: () => undefined,
    getAll: () => [],
    has: () => false,
  }),
}))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  },
}))
vi.mock('@/lib/engine', () => ({ getEngine: vi.fn(async () => mockEngine) }))
vi.mock('@/features/organizations/visibility', () => ({ orgGateLocked: async () => false, listOrgRestrictedIdsLive: async () => new Set<number>() }))
vi.mock('@/features/visibility/excludeProtected', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/visibility/excludeProtected')>()),
  excludeProtected: async (_c: string, docs: unknown[]) => docs,
}))

import RootLayout from '@/app/(frontend)/layout'
import HomePage, { generateMetadata as homeMetadata } from '@/app/(frontend)/page'
import BlogPostPage, { generateMetadata as blogMetadata } from '@/app/(frontend)/blog/[slug]/page'
import ProductPage, { generateMetadata as productMetadata } from '@/app/(frontend)/shop/[slug]/page'

type Row = Record<string, unknown>

const NOW = new Date().toISOString()
const PRODUCTS: Row[] = [
  { id: 20, title: 'Grace candle', slug: 'grace-candle', _status: 'published', priceInAUD: 4200, createdAt: NOW, productType: 'simple' },
  { id: 21, title: 'Linen tote', slug: 'linen-tote', _status: 'published', priceInAUD: 6500, createdAt: NOW, productType: 'simple' },
]
const POSTS: Row[] = [{ id: 1, title: 'Hello', slug: 'hello', _status: 'published', createdAt: NOW, publishedAt: NOW }]
const COLLECTIONS: Record<string, Row[]> = { pages: [], posts: POSTS, products: PRODUCTS, events: [], 'product-reviews': [] }

/** The subset of the Where syntax the sample pages send. */
function matches(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'and') return (value as Record<string, unknown>[]).every((part) => matches(row, part))
    if (key === 'or') return (value as Record<string, unknown>[]).some((part) => matches(row, part))
    return Object.entries(value as Record<string, unknown>).every(([operator, operand]) => {
      const field = row[key]
      if (operator === 'equals') return field === operand
      if (operator === 'greater_than_equal') return String(field) >= String(operand)
      return true
    })
  })
}

const SITE = { siteName: 'Grace & Gatsby', features: { blog: true, ecommerce: true, events: true, faq: true, accounts: false } }

beforeEach(() => {
  vi.clearAllMocks()
  startRequest()
  mockEngine.findGlobal.mockImplementation(async ({ slug }: { slug: string }) => {
    if (slug === 'site-settings') return SITE
    if (slug === 'shop-settings') return { currency: 'AUD' }
    return { menu: [], columns: [] }
  })
  mockEngine.find.mockImplementation(async (args: { collection: string; where?: Record<string, unknown>; limit?: number }) => {
    const rows = COLLECTIONS[args.collection] ?? []
    const matched = args.where ? rows.filter((row) => matches(row, args.where as Record<string, unknown>)) : rows
    const limit = args.limit && args.limit > 0 ? args.limit : matched.length
    return { docs: matched.slice(0, limit), totalDocs: matched.length }
  })
})

/**
 * Resolves the async server components a page returns (a page may hand off to
 * one), so the reads they make run. Synchronous components are not called.
 */
async function resolveServerTree(node: unknown): Promise<unknown> {
  let current = node as { type?: unknown; props?: unknown } | null
  while (current && typeof current === 'object' && typeof current.type === 'function' && current.type.constructor.name === 'AsyncFunction') {
    current = (await (current.type as (props: unknown) => Promise<unknown>)(current.props)) as typeof current
  }
  return current
}

/** One request: metadata first (as Next does), then the page. Returns the reads made. */
async function requestReads(run: () => Promise<unknown>): Promise<number> {
  startRequest()
  mockEngine.find.mockClear()
  mockEngine.findGlobal.mockClear()
  await run()
  return mockEngine.find.mock.calls.length + mockEngine.findGlobal.mock.calls.length
}

/** The root layout runs on every public page, so its reads count too. */
const layout = async (): Promise<unknown> => resolveServerTree(await RootLayout({ children: null }))

describe('database reads per public page', () => {
  it('home page (default homepage, no page set as homepage)', async () => {
    const reads = await requestReads(async () => {
      await layout()
      await homeMetadata()
      await resolveServerTree(await HomePage({ searchParams: Promise.resolve({}) }))
    })
    expect(reads).toBeLessThanOrEqual(MAX_HOME_READS)
  })

  it('blog post page (metadata and body)', async () => {
    const params = Promise.resolve({ slug: 'hello' })
    const searchParams = Promise.resolve({})
    const reads = await requestReads(async () => {
      await layout()
      await blogMetadata({ params })
      await resolveServerTree(await BlogPostPage({ params, searchParams }))
    })
    expect(reads).toBeLessThanOrEqual(MAX_POST_READS)
  })

  it('product page (metadata and body)', async () => {
    const params = Promise.resolve({ slug: 'grace-candle' })
    const searchParams = Promise.resolve({})
    const reads = await requestReads(async () => {
      await layout()
      await productMetadata({ params })
      await resolveServerTree(await ProductPage({ params, searchParams }))
    })
    expect(reads).toBeLessThanOrEqual(MAX_PRODUCT_READS)
  })
})

// Upper bounds: the measured counts after Task 12 (the layout's 7 reads, then the page's own).
// Home and product pages gained one read each (the shop-extra-settings global that holds the promo badges, Task 6).
const MAX_HOME_READS = 12
const MAX_POST_READS = 9
const MAX_PRODUCT_READS = 10
