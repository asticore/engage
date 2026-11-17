import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PageJsonLd } from '@/features/seo'
import { breadcrumbTrail } from '@/features/seo/schemaNodes'

vi.mock('@/features/seo/settings', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>
  return { ...actual, getSeoContext: vi.fn() }
})

import { getSeoContext } from '@/features/seo/settings'
const mockCtx = vi.mocked(getSeoContext)

const ctx = (settings: unknown) =>
  mockCtx.mockResolvedValue({ enabled: true, settings, siteName: 'Ex', baseUrl: 'https://example.com' } as never)
const html = (r: unknown): string => (r as { props: { dangerouslySetInnerHTML: { __html: string } } }).props.dangerouslySetInnerHTML.__html

describe('breadcrumb schema on pages and posts', () => {
  beforeEach(() => ctx(null))

  it('uses the sitewide Home label in the trail', () => {
    const t = breadcrumbTrail({ collection: 'posts', baseUrl: 'https://e.com', path: '/blog/a', title: 'A', homeLabel: 'Start' })
    expect(t[0].name).toBe('Start')
    expect(breadcrumbTrail({ collection: 'posts', baseUrl: 'https://e.com', path: '/blog/a', title: 'A' })[0].name).toBe('Home')
  })

  it('emits BreadcrumbList for a post by default', async () => {
    const r = await PageJsonLd({ collection: 'posts', doc: { title: 'Post' }, path: '/blog/post' })
    expect(html(r)).toContain('BreadcrumbList')
  })

  it('applies the Home label setting', async () => {
    ctx({ breadcrumbs: { homeLabel: 'Start' } })
    const r = await PageJsonLd({ collection: 'pages', doc: { title: 'About' }, path: '/about' })
    expect(html(r)).toContain('"name":"Start"')
  })

  it('omits the trail when structured data is off', async () => {
    ctx({ breadcrumbs: { structuredData: false } })
    const r = await PageJsonLd({ collection: 'pages', doc: { title: 'About' }, path: '/about' })
    expect(html(r)).not.toContain('BreadcrumbList')
  })
})
