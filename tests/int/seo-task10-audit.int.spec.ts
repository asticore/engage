import { describe, it, expect } from 'vitest'
import { buildAuditRow, ORPHAN_PROBLEM } from '@/features/seo/audit'
import { internalPathOf, internalTargetsOf, isOrphan, pagePathOf, suggestInternalLinks } from '@/features/seo/internalLinks'
import { loadAuditRows, type AuditFindEngine } from '@/features/seo/auditLoader'
import { parseSeoEdits, seoEditData, MAX_SEO_EDIT_ROWS } from '@/features/seo/auditEdits'
import { changedSeoRows, rowKey } from '@/features/seo/auditEdits'
import { analyze } from '@/features/seo/analysis/analyze'
import { renderSitemapXml, type SitemapEntry } from '@/features/seo/sitemap'
import { videoElementsOf, videoObjectNodes } from '@/features/seo/videoNodes'
import { buildFaqPageJsonLd, buildPageJsonLd } from '@/features/seo/pageSchema'
import { slugRedirectPaths } from '@/features/redirects/slugChange'

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')

describe('internal links', () => {
  it('reads only internal paths, without query, fragment or trailing slash', () => {
    expect(internalPathOf('/about/?x=1#top')).toBe('/about')
    expect(internalPathOf('about')).toBe('/about')
    expect(internalPathOf('/')).toBe('/')
    expect(internalPathOf('https://example.com/about')).toBeNull()
    expect(internalPathOf('mailto:a@b.co')).toBeNull()
  })

  it('collects the distinct internal targets of a document', () => {
    const doc = {
      title: 'Home',
      content: { root: { children: [{ type: 'link', url: '/services' }, { type: 'link', url: '/services/' }, { type: 'link', url: 'https://other.example/x' }] } },
    }
    expect(internalTargetsOf(doc)).toEqual(['/services'])
  })

  it('builds a nested page path from the parent chain', () => {
    const pages = new Map<string, Record<string, unknown>>([['1', { id: 1, slug: 'services', parent: null }]])
    const child = { id: 2, slug: 'consulting', parent: 1 }
    expect(pagePathOf(child, (id) => pages.get(id))).toBe('/services/consulting')
    expect(pagePathOf({ id: 3, slug: 'x', isHomepage: true }, () => undefined)).toBe('/')
  })

  it('treats the home page as never an orphan', () => {
    expect(isOrphan('/', false)).toBe(false)
    expect(isOrphan('/lonely', false)).toBe(true)
    expect(isOrphan('/lonely', true)).toBe(false)
  })

  it('suggests up to five other pages that share title words, skipping itself and existing links', () => {
    const candidates = [
      { title: 'Running shoes for beginners', href: '/running-shoes' },
      { title: 'Shoe care guide', href: '/shoe-care' },
      { title: 'Running tips', href: '/running-tips' },
      { title: 'Trail running shoes', href: '/trail' },
      { title: 'Shoes for running on snow', href: '/snow' },
      { title: 'Running club', href: '/club' },
      { title: 'Cooking pasta', href: '/pasta' },
    ]
    const result = suggestInternalLinks(
      { title: 'Running shoes', keyphrase: 'running shoes', href: '/running-shoes', linksOut: new Set(['/trail']) },
      candidates,
    )
    expect(result.length).toBeLessThanOrEqual(5)
    expect(result.map((c) => c.href)).not.toContain('/running-shoes')
    expect(result.map((c) => c.href)).not.toContain('/trail')
    expect(result.map((c) => c.href)).not.toContain('/pasta')
    expect(result[0].href).toBe('/snow')
  })

  it('suggests nothing when no title shares a word', () => {
    expect(suggestInternalLinks({ title: 'Pasta', keyphrase: '', href: '/pasta', linksOut: new Set() }, [{ title: 'Shoes', href: '/shoes' }])).toEqual([])
  })
})

describe('audit loader: orphans, suggestions and cornerstone', () => {
  const engineWith = (data: Record<string, Record<string, unknown>[]>): AuditFindEngine => ({
    find: async ({ collection }) => ({ docs: data[collection] ?? [] }),
  })

  it('flags a page no content links to, but not one that only links to itself', async () => {
    const data = {
      pages: [
        { id: 1, title: 'Home', slug: 'home', isHomepage: true, _status: 'published', seo: {} },
        { id: 2, title: 'Linked', slug: 'linked', _status: 'published', seo: {} },
        { id: 3, title: 'Lonely', slug: 'lonely', _status: 'published', seo: {} },
        { id: 4, title: 'Self', slug: 'self', _status: 'published', seo: {}, content: { root: { children: [{ type: 'link', url: '/self' }] } } },
      ],
      posts: [{ id: 1, title: 'Post', slug: 'post', _status: 'published', seo: {}, content: { root: { children: [{ type: 'link', url: '/linked' }] } } }],
    }
    const rows = await loadAuditRows(engineWith(data), ['pages'])
    const byTitle = Object.fromEntries(rows.map((r) => [r.title, r]))
    expect(byTitle.Linked.orphan).toBe(false)
    expect(byTitle.Lonely.orphan).toBe(true)
    expect(byTitle.Lonely.problems).toContain(ORPHAN_PROBLEM)
    expect(byTitle.Self.orphan).toBe(true)
    expect(byTitle.Home.orphan).toBe(false)
  })

  it('returns only the allowed collections as rows, and suggestions only for pages', async () => {
    const data = {
      pages: [
        { id: 1, title: 'Running shoes', slug: 'running-shoes', _status: 'published', seo: { focusKeyphrase: 'running shoes' } },
        { id: 2, title: 'Shoe care', slug: 'shoe-care', _status: 'published', seo: {} },
      ],
      posts: [{ id: 5, title: 'Running shoes review', slug: 'review', _status: 'published', seo: {} }],
    }
    const rows = await loadAuditRows(engineWith(data), ['posts'])
    expect(rows.map((r) => r.collection)).toEqual(['posts'])
    expect(rows[0].orphan).toBe(false)
    expect(rows[0].linkSuggestions).toEqual([])
    const pageRows = await loadAuditRows(engineWith(data), ['pages'])
    const first = pageRows.find((r) => r.title === 'Running shoes')
    expect(first?.linkSuggestions.map((s) => s.href)).toEqual(['/shoe-care'])
  })

  it('reads the cornerstone flag from the SEO group', () => {
    expect(buildAuditRow({ id: 1, title: 'A', slug: 'a', seo: { cornerstone: true } }, 'pages').cornerstone).toBe(true)
    expect(buildAuditRow({ id: 1, title: 'A', slug: 'a', seo: {} }, 'pages').cornerstone).toBe(false)
  })
})

describe('cornerstone analysis', () => {
  const base = { title: 'Running shoes guide for every runner', slug: 'running-shoes', metaTitle: 'Running shoes guide for every runner', metaDescription: 'A'.repeat(130) + ' running shoes', keyphrase: 'running shoes', text: `Running shoes are useful. ${words(400)}`, headings: [] as { level: number; text: string }[], links: [{ href: '/a', internal: true }], images: [] as { alt: string }[] }

  it('keeps the usual thresholds for an ordinary page', () => {
    const result = analyze({ ...base, cornerstone: false })
    expect(result.seo.find((c) => c.id === 'text-length')?.status).toBe('good')
    expect(result.seo.find((c) => c.id === 'keyphrase-in-subheading')?.status).toBe('ok')
  })

  it('asks a cornerstone page for 900 words and marks missing subheadings and links as bad', () => {
    const result = analyze({ ...base, cornerstone: true })
    expect(result.seo.find((c) => c.id === 'text-length')?.status).toBe('bad')
    expect(result.seo.find((c) => c.id === 'keyphrase-in-subheading')?.status).toBe('bad')
    const long = analyze({ ...base, text: `Running shoes are useful. ${words(950)}`, headings: [{ level: 2, text: 'Running shoes' }], links: [{ href: '/a', internal: true }], cornerstone: true })
    expect(long.seo.find((c) => c.id === 'text-length')?.status).toBe('good')
    expect(long.seo.find((c) => c.id === 'keyphrase-in-subheading')?.status).toBe('good')
  })
})

describe('bulk SEO edits', () => {
  it('accepts a list of rows and trims the text', () => {
    const parsed = parseSeoEdits({ rows: [{ collection: 'pages', id: 4, metaTitle: '  New title  ', metaDescription: 'Desc' }] })
    expect(parsed).toEqual({ rows: [{ collection: 'pages', id: 4, metaTitle: 'New title', metaDescription: 'Desc' }] })
  })

  it('refuses unknown places, bad ids, too many rows and nothing to save', () => {
    expect(parseSeoEdits({ rows: [{ collection: 'orders', id: 1, metaTitle: 'x' }] })).toHaveProperty('error')
    expect(parseSeoEdits({ rows: [{ collection: 'pages', id: 'abc', metaTitle: 'x' }] })).toHaveProperty('error')
    expect(parseSeoEdits({ rows: [{ collection: 'pages', id: 1, metaTitle: 'x'.repeat(301) }] })).toHaveProperty('error')
    expect(parseSeoEdits({ rows: Array.from({ length: MAX_SEO_EDIT_ROWS + 1 }, (_, i) => ({ collection: 'pages', id: i + 1, metaTitle: 'x' })) })).toHaveProperty('error')
    expect(parseSeoEdits({ rows: [{ collection: 'pages', id: 1 }] })).toHaveProperty('error')
    expect(parseSeoEdits(null)).toHaveProperty('error')
  })

  it('writes the SEO group with the edited fields and keeps the other SEO settings', () => {
    const current = { id: 4, seo: { metaTitle: 'Old', metaDescription: 'Old desc', noIndex: true, ogImage: 9 } }
    expect(seoEditData(current, { collection: 'pages', id: 4, metaTitle: 'New' })).toEqual({ seo: { metaTitle: 'New', metaDescription: 'Old desc', noIndex: true, ogImage: 9 } })
  })

  it('sends only rows whose values changed', () => {
    const row = buildAuditRow({ id: 4, title: 'A', slug: 'a', seo: { metaTitle: 'Same', metaDescription: 'Old' } }, 'pages')
    const edits = { [rowKey(row)]: { metaTitle: 'Same', metaDescription: 'New' } }
    expect(changedSeoRows([row], edits)).toEqual([{ collection: 'pages', id: 4, metaDescription: 'New' }])
    expect(changedSeoRows([row], { [rowKey(row)]: { metaTitle: 'Same' } })).toEqual([])
  })
})

describe('sitemap images', () => {
  it('lists the pictures of an entry under the image namespace', () => {
    const entries: SitemapEntry[] = [
      { url: 'https://example.com/blog/a', changeFrequency: 'weekly', priority: 0.6, images: [{ url: 'https://example.com/m/a.jpg', title: 'A & B' }] },
      { url: 'https://example.com/about', changeFrequency: 'weekly', priority: 0.8 },
    ]
    const xml = renderSitemapXml(entries)
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"')
    expect(xml).toContain('<image:loc>https://example.com/m/a.jpg</image:loc>')
    expect(xml).toContain('<image:title>A &amp; B</image:title>')
    expect(xml.match(/<image:image>/g)).toHaveLength(1)
  })

  it('leaves the image namespace out when no entry has pictures', () => {
    const xml = renderSitemapXml([{ url: 'https://example.com/a', changeFrequency: 'weekly', priority: 0.5 }])
    expect(xml).not.toContain('sitemap-image')
  })
})

describe('video JSON-LD', () => {
  const page = { blocks: [{ blockType: 'section', children: [{ blockType: 'element', elementType: 'video', props: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Tour', caption: 'A short tour' } }] }] }

  it('finds video elements anywhere in the blocks', () => {
    expect(videoElementsOf(page)).toEqual([{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Tour', caption: 'A short tour' }])
  })

  it('describes a YouTube video with name, thumbnail, upload date and embed', () => {
    const nodes = videoObjectNodes(videoElementsOf(page), { title: 'Page', description: 'Desc', publishedDate: '2026-10-01T00:00:00.000Z' })
    expect(nodes).toEqual([
      {
        '@type': 'VideoObject',
        name: 'Tour',
        thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        uploadDate: '2026-10-01T00:00:00.000Z',
        embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        description: 'A short tour',
      },
    ])
  })

  it('gives no node for Vimeo, uploaded files or a page with no publish date', () => {
    const vimeo = [{ url: 'https://vimeo.com/123456789', title: 'V', caption: '' }]
    const file = [{ url: 'https://example.com/media/clip.mp4', title: 'F', caption: '' }]
    expect(videoObjectNodes(vimeo, { title: 'P', publishedDate: '2026-10-01' })).toEqual([])
    expect(videoObjectNodes(file, { title: 'P', publishedDate: '2026-10-01' })).toEqual([])
    expect(videoObjectNodes(videoElementsOf(page), { title: 'P' })).toEqual([])
  })
})

describe('FAQ structured data', () => {
  const faqs = [
    { question: 'Is it free?', answer: 'Yes.' },
    { question: '', answer: 'No question here.' },
  ]

  it('keeps questions off a WebPage node and emits them as a separate FAQPage node', () => {
    const page = buildPageJsonLd({ collection: 'pages', title: 'Help', url: 'https://example.com/help', baseUrl: 'https://example.com', siteName: 'Site', faqs })
    expect(page?.['@type']).toBe('WebPage')
    expect(page?.mainEntity).toBeUndefined()
    const faq = buildFaqPageJsonLd({ url: 'https://example.com/help', name: 'Help', faqs })
    expect(faq?.['@type']).toBe('FAQPage')
    expect(faq?.mainEntity).toEqual([{ '@type': 'Question', name: 'Is it free?', acceptedAnswer: { '@type': 'Answer', text: 'Yes.' } }])
  })

  it('gives no FAQPage node when no entry has both a question and an answer', () => {
    expect(buildFaqPageJsonLd({ url: 'https://example.com/faq', name: 'FAQ', faqs: [{ question: 'Q', answer: '' }] })).toBeNull()
  })
})

describe('slug change redirects', () => {
  it('maps the old and new address under the collection prefix', () => {
    expect(slugRedirectPaths('posts', 'old-post', 'new-post')).toEqual({ fromPath: '/blog/old-post', toPath: '/blog/new-post' })
    expect(slugRedirectPaths('products', 'mug', 'big-mug')).toEqual({ fromPath: '/shop/mug', toPath: '/shop/big-mug' })
    expect(slugRedirectPaths('events', 'gala', 'gala-2')).toEqual({ fromPath: '/events/gala', toPath: '/events/gala-2' })
  })

  it('returns nothing when the slug did not change or is missing', () => {
    expect(slugRedirectPaths('posts', 'same', 'same')).toBeNull()
    expect(slugRedirectPaths('posts', undefined, 'new')).toBeNull()
    expect(slugRedirectPaths('posts', 'old', '')).toBeNull()
  })
})
