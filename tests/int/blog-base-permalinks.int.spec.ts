// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

import {
  DEFAULT_BLOG_BASE,
  blogPath,
  isUnderPath,
  resolveBlogBase,
  validateBlogBase,
} from '@/features/seo/permalinks'
import { validateBlogBaseField, BLOG_BASE_PAGE_MESSAGE } from '@/features/seo/permalinkValidate'

const state = vi.hoisted(() => ({
  adminPath: '/admin' as string,
  blog: 'blog' as string,
  shop: 'shop' as string,
  seen: [] as string[],
}))

vi.mock('@/features/security', () => ({
  readSecuritySettingsFromD1: async () => ({ adminPath: state.adminPath, signInPaths: { customer: '', member: '' } }),
  securityMiddleware: async (request: NextRequest) => {
    state.seen.push(request.nextUrl.pathname)
    return NextResponse.next()
  },
}))
vi.mock('@/features/multilingual/middleware', () => ({
  // Mimics a site with French on: a /fr prefix is stripped and the locale header set before the inner handler runs.
  multilingualMiddleware: async (request: NextRequest, handle: (r: NextRequest) => Promise<NextResponse>) => {
    const p = request.nextUrl.pathname
    if (p === '/fr' || p.startsWith('/fr/')) {
      const url = new URL(request.url)
      url.pathname = p.slice(3) || '/'
      const headers = new Headers(request.headers)
      headers.set('x-eg-locale', 'fr')
      return handle(new NextRequest(url, { headers, method: request.method }))
    }
    return handle(request)
  },
}))
vi.mock('@/features/seo/permalinkStore', () => ({
  readBlogBase: async (): Promise<string> => state.blog,
  readShopBase: async (): Promise<string> => state.shop,
  invalidateBlogBaseCache: (): void => undefined,
}))

import { middleware } from '@/middleware'

const ctx = { adminRoot: '/admin', signInPaths: ['/account/sign-in', '/account/member-sign-in'] }
const get = (path: string, init?: RequestInit) => middleware(new NextRequest(`https://site.test${path}`, init as never))

describe('blog address rules', () => {
  it.each(['news', 'journal-2', 'blog', '/news/', 'abc'])('accepts %s', (v) => {
    expect(validateBlogBase(v, ctx)).toBeNull()
  })
  it('rejects bad format and length', () => {
    expect(validateBlogBase('News', ctx)).toBe('format')
    expect(validateBlogBase('a/b', ctx)).toBe('format')
    expect(validateBlogBase('ab', ctx)).toBe('length')
    expect(validateBlogBase('x'.repeat(41), ctx)).toBe('length')
  })
  it('refuses site words, the admin address and sign-in addresses', () => {
    expect(validateBlogBase('shop', ctx)).toBe('reserved')
    expect(validateBlogBase('account', ctx)).toBe('reserved')
    expect(validateBlogBase('feed', ctx)).toBe('reserved')
    expect(validateBlogBase('studio-7f3', { ...ctx, adminRoot: '/studio-7f3' })).toBe('admin')
    expect(validateBlogBase('welcome-in', { ...ctx, signInPaths: ['/welcome-in'] })).toBe('signIn')
  })
  it('resolves a stored value, falling back to the default when it is bad', () => {
    expect(resolveBlogBase(null)).toBe(DEFAULT_BLOG_BASE)
    expect(resolveBlogBase('')).toBe('blog')
    expect(resolveBlogBase('/news/')).toBe('news')
    expect(resolveBlogBase('Bad Value')).toBe('blog')
    expect(resolveBlogBase('shop')).toBe('blog')
  })
  it('builds public paths and matches whole segments only', () => {
    expect(blogPath('news', '/hello')).toBe('/news/hello')
    expect(blogPath('blog')).toBe('/blog')
    expect(isUnderPath('/news/x', '/news')).toBe(true)
    expect(isUnderPath('/newsroom', '/news')).toBe(false)
  })
})

describe('blog address field validator', () => {
  const pages = (slugs: string[]) => ({
    engine: {
      find: async (args: Record<string, unknown>) => ({
        docs: slugs.filter((s) => s === (args as { where: { and: { slug?: { equals: string } }[] } }).where.and[0].slug?.equals),
      }),
    },
  })

  it('accepts empty and the default', async () => {
    const v = validateBlogBaseField()
    expect(await v('')).toBe(true)
    expect(await v('blog')).toBe(true)
  })
  it('returns the message for a refused value', async () => {
    const v = validateBlogBaseField()
    expect(await v('ab')).toMatch(/between 3 and 40/)
    expect(await v('shop')).toMatch(/site itself/)
  })
  it('refuses an address a top-level page already uses', async () => {
    const v = validateBlogBaseField()
    expect(await v('news', { req: pages(['news']) })).toBe(BLOG_BASE_PAGE_MESSAGE)
    expect(await v('news', { req: pages(['about']) })).toBe(true)
    const broken = { engine: { find: async () => { throw new Error('db down') } } }
    expect(await v('news', { req: broken })).toBe(true)
  })
})

describe('middleware with a custom blog address', () => {
  beforeEach(() => {
    state.adminPath = '/admin'
    state.blog = 'news'
    state.seen = []
  })

  it('serves the new address from the /blog folder', async () => {
    const res = await get('/news/hello-world')
    expect(state.seen).toEqual(['/blog/hello-world'])
    expect(res.headers.get('x-middleware-rewrite')).toBe('https://site.test/blog/hello-world')
  })

  it('keeps the query on the rewritten address', async () => {
    const res = await get('/news?page=2')
    expect(res.headers.get('x-middleware-rewrite')).toBe('https://site.test/blog?page=2')
  })

  it('308-redirects a page view of the old address to the new one', async () => {
    const res = await get('/blog/hello-world?utm=x')
    expect(res.status).toBe(308)
    expect(res.headers.get('location')).toBe('https://site.test/news/hello-world?utm=x')
    expect(state.seen).toEqual([])
  })

  it('does not redirect a non-page request to the old address', async () => {
    const res = await get('/blog/hello-world', { method: 'POST' })
    expect(res.status).not.toBe(308)
  })

  it('leaves other paths alone', async () => {
    await get('/newsroom')
    expect(state.seen).toEqual(['/newsroom'])
  })

  it('does nothing when the address is the default', async () => {
    state.blog = 'blog'
    const res = await get('/blog/hello-world')
    expect(res.status).not.toBe(308)
    expect(state.seen).toEqual(['/blog/hello-world'])
  })

  it('serves the custom address under a language prefix, and sends the old one to it', async () => {
    const res = await get('/fr/news/hello-world')
    expect(state.seen).toEqual(['/blog/hello-world'])
    expect(res.headers.get('x-middleware-rewrite')).toBe('https://site.test/blog/hello-world')
    const old = await get('/fr/blog/hello-world')
    expect(old.status).toBe(308)
    expect(old.headers.get('location')).toBe('https://site.test/fr/news/hello-world')
  })
})

describe('middleware with a custom shop address', () => {
  beforeEach(() => {
    state.adminPath = '/admin'
    state.blog = 'blog'
    state.shop = 'store'
    state.seen = []
  })

  it('serves the new address and the category pages from the /shop folder', async () => {
    const res = await get('/store/mug')
    expect(state.seen).toEqual(['/shop/mug'])
    expect(res.headers.get('x-middleware-rewrite')).toBe('https://site.test/shop/mug')
    const category = await get('/store/category/tea/green?page=2')
    expect(category.headers.get('x-middleware-rewrite')).toBe('https://site.test/shop/category/tea/green?page=2')
  })

  it('308-redirects the old /shop address, keeping the query', async () => {
    const res = await get('/shop/mug?utm=x')
    expect(res.status).toBe(308)
    expect(res.headers.get('location')).toBe('https://site.test/store/mug?utm=x')
  })

  it('leaves the cart, checkout and cart-recover addresses where they are', async () => {
    await get('/cart')
    await get('/checkout/success')
    await get('/api/shop-cart-recover?t=abc')
    expect(state.seen).toEqual(['/cart', '/checkout/success', '/api/shop-cart-recover'])
  })

  it('does not redirect a POST to the old address (an API call keeps working)', async () => {
    const res = await get('/shop/mug', { method: 'POST' })
    expect(res.status).not.toBe(308)
  })

  it('works under a language prefix, and sends the old address to the new one', async () => {
    const res = await get('/fr/store/mug')
    expect(state.seen).toEqual(['/shop/mug'])
    expect(res.headers.get('x-middleware-rewrite')).toBe('https://site.test/shop/mug')
    const old = await get('/fr/shop/mug')
    expect(old.status).toBe(308)
    expect(old.headers.get('location')).toBe('https://site.test/fr/store/mug')
  })

  it('does nothing while /shop is the address', async () => {
    state.shop = 'shop'
    const res = await get('/shop/mug')
    expect(res.status).not.toBe(308)
    expect(state.seen).toEqual(['/shop/mug'])
  })

  it('can run next to a custom blog address', async () => {
    state.blog = 'news'
    const blog = await get('/news/hello')
    expect(blog.headers.get('x-middleware-rewrite')).toBe('https://site.test/blog/hello')
    const shop = await get('/store/mug')
    expect(shop.headers.get('x-middleware-rewrite')).toBe('https://site.test/shop/mug')
  })
})
