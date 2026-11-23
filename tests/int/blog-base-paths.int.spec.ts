// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'

import { slugRedirectPaths } from '@/features/redirects/slugChange'
import { buildMergeContext } from '@/lib/mergeTags'
import { breadcrumbTrail } from '@/features/seo/schemaNodes'
import { invalidateBlogBaseCache, readBlogBase } from '@/features/seo/permalinkStore'

describe('places that build the blog path follow the blog address', () => {
  it('slug redirects use the chosen address, and /blog by default', () => {
    expect(slugRedirectPaths('posts', 'a', 'b', 'news')).toEqual({ fromPath: '/news/a', toPath: '/news/b' })
    expect(slugRedirectPaths('posts', 'a', 'b')).toEqual({ fromPath: '/blog/a', toPath: '/blog/b' })
    expect(slugRedirectPaths('products', 'a', 'b', 'news')).toEqual({ fromPath: '/shop/a', toPath: '/shop/b' })
  })

  it('the {{url}} merge tag of a post follows the address', () => {
    expect(buildMergeContext({ slug: 'hi', title: 'Hi' }, 'posts', undefined, undefined, 'news').url).toBe('/news/hi')
    expect(buildMergeContext({ slug: 'hi', title: 'Hi' }, 'posts').url).toBe('/blog/hi')
    expect(buildMergeContext({ slug: 'mug', title: 'Mug' }, 'products', undefined, undefined, 'news').url).toBe('/shop/mug')
  })

  it('post breadcrumbs use the address for the section crumb', () => {
    const trail = breadcrumbTrail({ collection: 'posts', baseUrl: 'https://x.test', path: '/news/hi', title: 'Hi', blogBase: 'news' })
    expect(trail.map((c) => c.url)).toEqual(['https://x.test/', 'https://x.test/news', 'https://x.test/news/hi'])
  })
})

describe('ENGAGE_BLOG_BASE recovery override', () => {
  afterEach(() => {
    delete process.env.ENGAGE_BLOG_BASE
    invalidateBlogBaseCache()
  })
  it('wins over the saved value, and a bad value falls back to /blog', async () => {
    process.env.ENGAGE_BLOG_BASE = 'journal'
    invalidateBlogBaseCache()
    expect(await readBlogBase()).toBe('journal')
    process.env.ENGAGE_BLOG_BASE = 'admin/../x'
    expect(await readBlogBase()).toBe('blog')
  })
})
