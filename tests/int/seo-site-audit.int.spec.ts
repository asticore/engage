import { describe, it, expect } from 'vitest'

import { parseHtmlFacts } from '@/features/seo/crawl/htmlFacts'
import { healthScore, ISSUE_BY_ID, ISSUE_CATALOG, linkGraph, pageIssues, siteIssues, titlePixelWidth, type CrawlPage } from '@/features/seo/crawl/issues'
import { toStoredPage } from '@/features/seo/crawl/model'
import { COLUMNS, deltaText, filterRows, EMPTY_FILTER, indexabilityOf, issueCounts, sortRows, toCsv } from '@/features/seo/crawl/table'
import type { PageRow } from '@/features/seo/crawl/store'
import { scheduleDue } from '@/features/seo/crawl/store'
import { accessibilityChecks, headingOrderProblems } from '@/features/seo/analysis/accessibility'
import { analyze } from '@/features/seo/analysis/analyze'
import { SNIPPET_TYPES, detectSnippetTypes, panelRows, suggestSnippetTypes } from '@/features/seo/snippets'
import { ownChecklist, ownScores } from '@/features/seo/pageCheck'
import { auditStatus, groupChecklist, parseChecklist } from '@/features/pagespeed/checklist'
import { buildAuditRow } from '@/features/seo/audit'
import { crawlOne } from '@/features/seo/crawl/runner'

const GOOD = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>A good page title that is long enough</title>
<meta name="description" content="A description of the page that is long enough to be useful to someone reading the search result page."><meta name="viewport" content="width=device-width">
<link rel="canonical" href="https://example.com/good"><link rel="icon" href="/f.ico"><meta property="og:title" content="t"><meta property="og:image" content="i">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"H","image":"i","datePublished":"2026-01-01","dateModified":"2026-01-02","author":{"@type":"Person","name":"A"}}</script></head>
<body><a href="#main">Skip to content</a><header><nav><a href="/">Home</a></nav></header><main id="main"><h1>Main heading</h1><h2>What is a good page?</h2>
<p>${'A good page answers the question clearly and briefly so that readers and search engines understand it quickly. '.repeat(2)}</p>
<ul><li>One</li><li>Two</li></ul><table><tr><th>A</th></tr><tr><td>1</td></tr></table>
<img src="/a.webp" alt="A" width="10" height="10"><p>${'word '.repeat(300)}</p><a href="/other">Other page</a></main><footer>f</footer></body></html>`

const BAD = `<html><head></head><body><h1>One</h1><h1>Two</h1><h4>Skipped</h4><img src="a.jpg"><a href="/x"></a><button></button><input type="text">
<div id="d"></div><div id="d"></div><div role="bogus"></div><iframe src="x"></iframe><a href="http://x.test/">click here</a></body></html>`

const page = (path: string, html: string | null, extra: Partial<CrawlPage<ReturnType<typeof parseHtmlFacts>>> = {}): CrawlPage<ReturnType<typeof parseHtmlFacts>> => ({
  path, statusCode: 200, responseMs: 100, redirectTo: null, redirectHops: 0, inSitemap: true, facts: html ? parseHtmlFacts(html) : null,
  depth: null, inLinks: 0, outInternal: 0, outExternal: 0, brokenLinks: 0, ...extra,
})

describe('parseHtmlFacts', () => {
  it('reads the head, headings, links, images and JSON-LD', () => {
    const f = parseHtmlFacts(GOOD)
    expect(f.lang).toBe('en')
    expect(f.title).toMatch(/good page title/)
    expect(f.canonical).toBe('https://example.com/good')
    expect(f.headings.map((h) => h.level)).toEqual([1, 2])
    expect(f.images[0]).toMatchObject({ alt: 'A', width: true, height: true })
    expect(f.jsonLd).toHaveLength(1)
    expect(f.landmarks.main).toBe(1)
    expect(f.questionAnswer).toBe(true)
    expect(f.lists).toBe(1)
    expect(f.tablesWithHeaders).toBe(1)
    expect(f.skipLink).toBe(true)
    expect(f.og['og:image']).toBe('i')
  })
  it('flags broken markup without throwing', () => {
    const f = parseHtmlFacts(BAD)
    expect(f.buttonsWithoutName).toBe(1)
    expect(f.inputsWithoutLabel).toBe(1)
    expect(f.iframesWithoutTitle).toBe(1)
    expect(f.duplicateIds).toEqual(['d'])
    expect(f.badAriaRoles).toEqual(['bogus'])
    expect(f.images[0].alt).toBeNull()
    expect(() => parseHtmlFacts('')).not.toThrow()
    expect(parseHtmlFacts('<script type="application/ld+json">{bad</script>').jsonLdInvalid).toBe(1)
  })
})

describe('page issues', () => {
  it('a good page has no errors', () => {
    const ids = pageIssues(page('/good', GOOD))
    expect(ids.filter((id) => ISSUE_BY_ID[id].severity === 'error')).toEqual([])
  })
  it('a bad page fails SEO and accessibility checks, each tagged with a kind', () => {
    const ids = pageIssues(page('/bad', BAD))
    for (const id of ['title-missing', 'description-missing', 'h1-multiple', 'thin-content', 'a11y-heading-order', 'a11y-no-main', 'a11y-image-alt', 'a11y-link-name', 'a11y-button-name', 'a11y-input-label', 'a11y-iframe-title', 'a11y-duplicate-id', 'a11y-aria-role', 'lang-missing', 'viewport-missing', 'link-text-generic']) {
      expect(ids, id).toContain(id)
    }
    expect(ISSUE_BY_ID['a11y-link-name'].kind).toBe('accessibility')
    expect(ISSUE_BY_ID['title-missing'].kind).toBe('seo')
  })
  it('every catalogue entry has a unique id, a hint and a label', () => {
    expect(new Set(ISSUE_CATALOG.map((d) => d.id)).size).toBe(ISSUE_CATALOG.length)
    for (const d of ISSUE_CATALOG) expect(d.hint.length).toBeGreaterThan(5)
  })
  it('reports status codes, slow responses and redirect chains', () => {
    expect(pageIssues(page('/gone', null, { statusCode: 404 }))).toContain('status-4xx')
    expect(pageIssues(page('/err', null, { statusCode: 500 }))).toContain('status-5xx')
    expect(pageIssues(page('/slow', GOOD, { responseMs: 2000 }))).toContain('slow-response')
    expect(pageIssues(page('/r', null, { statusCode: 301, redirectHops: 2 }))).toContain('redirect-chain')
    expect(pageIssues(page('/Bad_Path', GOOD))).toContain('url-format')
  })
  it('estimates a title width', () => {
    expect(titlePixelWidth('iiii')).toBeLessThan(titlePixelWidth('MMMM'))
  })
})

describe('link graph and site issues', () => {
  const origin = 'https://example.com'
  const mk = (path: string, links: string[], extra: Partial<CrawlPage<ReturnType<typeof parseHtmlFacts>>> = {}) => {
    const html = `<html lang="en"><head><title>${path} title is long enough here ok</title></head><body><main><h1>${path}</h1>${links.map((l) => `<a href="${l}">link</a>`).join('')}<p>${'text '.repeat(80)}</p></main></body></html>`
    return page(path, html, extra)
  }
  it('computes depth, links in, orphans and broken links', () => {
    const pages = [mk('/', ['/a', '/missing']), mk('/a', ['/b', 'https://other.test/']), mk('/b', ['/c']), mk('/c', ['/d']), mk('/d', []), mk('/lonely', []), page('/missing', null, { statusCode: 404 })]
    linkGraph(pages, origin)
    const by = Object.fromEntries(pages.map((p) => [p.path, p]))
    expect(by['/'].depth).toBe(0)
    expect(by['/d'].depth).toBe(4)
    expect(by['/a'].inLinks).toBe(1)
    expect(by['/'].brokenLinks).toBe(1)
    expect(by['/a'].outExternal).toBe(1)
    expect(by['/lonely'].depth).toBeNull()
    const cross = siteIssues(pages, origin)
    expect(cross.get('/lonely')).toContain('orphan')
    expect(cross.get('/d')).toContain('too-deep')
    expect(cross.get('/')).toBeUndefined()
  })
  it('finds duplicate titles and duplicate content', () => {
    const dup = '<html><head><title>Same</title><meta name="description" content="same"></head><body><h1>Same</h1><p>' + 'repeat '.repeat(80) + '</p></body></html>'
    const pages = [page('/one', dup), page('/two', dup), page('/three', GOOD)]
    const cross = siteIssues(pages, 'https://example.com')
    expect(cross.get('/one')).toEqual(expect.arrayContaining(['title-duplicate', 'description-duplicate', 'h1-duplicate', 'duplicate-content']))
    expect(cross.get('/three') ?? []).not.toEqual(expect.arrayContaining(['title-duplicate']))
  })
  it('flags a missing hreflang return link', () => {
    const a = page('/en', '<html><head><link rel="alternate" hreflang="fr" href="/fr"></head><body></body></html>')
    const b = page('/fr', '<html><head></head><body></body></html>')
    expect(siteIssues([a, b], 'https://example.com').get('/en')).toContain('hreflang-return')
  })
  it('scores site health', () => {
    expect(healthScore([]).score).toBe(100)
    const h = healthScore([[], ['title-missing'], ['title-short'], ['og-missing']])
    expect(h).toMatchObject({ errors: 1, warnings: 1, notices: 1 })
    expect(h.score).toBe(Math.round(((1 + 0 + 0.6 + 1) / 4) * 100))
  })
})

describe('crawlOne', () => {
  const origin = 'https://example.com'
  const reply = (status: number, body: string, headers: Record<string, string> = { 'content-type': 'text/html' }) => async () => new Response(body, { status, headers })
  it('stores facts and issues for an html page and measures the response', async () => {
    const result = await crawlOne(origin, '/good', true, reply(200, GOOD))
    expect(result.statusCode).toBe(200)
    expect(result.data?.title).toMatch(/good page title/)
    expect(result.bytes).toBeGreaterThan(100)
  })
  it('follows redirects by hand and counts hops', async () => {
    const calls: string[] = []
    const fetchImpl = async (url: string) => {
      calls.push(url)
      if (url.endsWith('/a')) return new Response(null, { status: 301, headers: { location: '/b' } })
      if (url.endsWith('/b')) return new Response(null, { status: 302, headers: { location: '/c' } })
      return new Response(GOOD, { status: 200, headers: { 'content-type': 'text/html' } })
    }
    const result = await crawlOne(origin, '/a', true, fetchImpl)
    expect(result.statusCode).toBe(301)
    expect(result.redirectHops).toBe(2)
    expect(result.redirectTo).toBe('/b')
    expect(result.issues).toContain('redirect-chain')
  })
  it('detects a redirect loop and a failed request', async () => {
    const loop = async (url: string) => new Response(null, { status: 301, headers: { location: url.endsWith('/x') ? '/y' : '/x' } })
    expect((await crawlOne(origin, '/x', false, loop)).issues).toContain('redirect-loop')
    const result = await crawlOne(origin, '/x', false, async () => { throw new Error('down') })
    expect(result.statusCode).toBe(504)
    expect(result.issues).toContain('status-5xx')
  })
})

describe('stored page and table', () => {
  const stored = (path: string, html: string | null, extra: Partial<PageRow> = {}): PageRow => ({
    id: Math.floor(Math.random() * 1e6), path, collection: null, docId: null, inSitemap: true, state: 'done', statusCode: 200, responseMs: 50, redirectTo: null, redirectHops: 0,
    bytes: 100, data: html ? toStoredPage(parseHtmlFacts(html)) : null, issues: html ? pageIssues(page(path, html)) : [], depth: 1, inLinks: 1, outInternal: 1, outExternal: 0, brokenLinks: 0, ...extra,
  })
  it('keeps what the table needs and detects snippet and schema types', () => {
    const s = toStoredPage(parseHtmlFacts(GOOD))
    expect(s.jsonLdTypes).toEqual(['Article'])
    expect(s.snippetTypes).toEqual(expect.arrayContaining(['article', 'paragraph', 'list', 'table']))
    expect(s.h1Count).toBe(1)
    expect(s.ogComplete).toBe(true)
  })
  it('works out indexability', () => {
    expect(indexabilityOf(stored('/ok', GOOD)).indexable).toBe(false) // canonical points to /good
    expect(indexabilityOf(stored('/good', GOOD)).indexable).toBe(true)
    expect(indexabilityOf(stored('/gone', null, { statusCode: 404 })).reason).toBe('Error 404')
    expect(indexabilityOf(stored('/r', null, { statusCode: 301, redirectHops: 1 })).reason).toBe('Redirects elsewhere')
  })
  it('filters, sorts and counts', () => {
    const rows = [stored('/good', GOOD), stored('/bad', BAD), stored('/gone', null, { statusCode: 404, issues: ['status-4xx'] })]
    expect(filterRows(rows, { ...EMPTY_FILTER, issue: 'status-4xx' }).map((r) => r.path)).toEqual(['/gone'])
    expect(filterRows(rows, { ...EMPTY_FILTER, search: 'BAD' }).map((r) => r.path)).toEqual(['/bad'])
    expect(filterRows(rows, { ...EMPTY_FILTER, severity: 'error' }).length).toBeGreaterThan(0)
    expect(sortRows(rows, 'issues', true)[0].path).toBe('/bad')
    expect(sortRows(rows, 'path', false)[0].path).toBe('/bad')
    expect(issueCounts(rows)[0].id).toBeTruthy()
    expect(COLUMNS.every((c) => typeof c.label === 'string')).toBe(true)
  })
  it('exports csv safely', () => {
    const rows = [stored('/x', '<html><head><title>=HYPERLINK("x")</title></head><body></body></html>')]
    const csv = toCsv(rows, ['path', 'title', 'issues'])
    expect(csv.split('\r\n')[0]).toBe('Address,Title,Issues,Checks failed')
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
  })
  it('describes the change since the last crawl', () => {
    expect(deltaText(5, 3)).toBe('+2')
    expect(deltaText(3, 5)).toBe('-2')
    expect(deltaText(3, 3)).toBe('no change')
    expect(deltaText(3, null)).toBe('')
  })
})

describe('schedule', () => {
  it('is due when set and the last run is old enough', () => {
    const now = new Date('2026-11-22T12:00:00Z')
    expect(scheduleDue('off', null, now)).toBe(false)
    expect(scheduleDue('daily', null, now)).toBe(true)
    expect(scheduleDue('daily', '2026-11-22T00:00:00Z', now)).toBe(false)
    expect(scheduleDue('daily', '2026-11-21T00:00:00Z', now)).toBe(true)
    expect(scheduleDue('weekly', '2026-11-18T00:00:00Z', now)).toBe(false)
    expect(scheduleDue('weekly', '2026-11-10T00:00:00Z', now)).toBe(true)
  })
})

describe('accessibility in the SEO analysis (16m)', () => {
  it('checks heading order and image alt text', () => {
    expect(headingOrderProblems([{ level: 1, text: 'a' }, { level: 3, text: 'b' }])).toHaveLength(1)
    const checks = accessibilityChecks({ headings: [{ level: 2, text: 'a' }, { level: 4, text: 'b' }], images: [{ alt: '' }, { alt: 'x' }] })
    expect(checks.find((c) => c.id === 'a11y-heading-order')?.status).toBe('bad')
    expect(checks.find((c) => c.id === 'a11y-image-alt')?.status).toBe('bad')
  })
  it('is part of the analysis result and marks audit findings as SEO or Accessibility', () => {
    const result = analyze({ title: 't', slug: 's', metaTitle: 't', metaDescription: '', keyphrase: '', text: 'hello', headings: [{ level: 1, text: 'a' }, { level: 3, text: 'b' }], links: [], images: [] })
    expect(result.accessibility.length).toBeGreaterThan(0)
    expect(result.accessibilityScore).toBe('bad')
    const row = buildAuditRow({ id: 1, title: 'T', slug: 's', seo: {}, content: { root: { children: [{ type: 'heading', tag: 'h1', children: [{ type: 'text', text: 'a' }] }, { type: 'heading', tag: 'h4', children: [{ type: 'text', text: 'b' }] }] } } }, 'pages')
    expect(row.findings?.some((f) => f.kind === 'accessibility')).toBe(true)
    expect(row.findings?.some((f) => f.kind === 'seo')).toBe(true)
    expect(row.problems.length).toBe(row.findings?.length)
  })
})

describe('snippets (16n)', () => {
  it('lists the Google gallery types and keeps ids unique', () => {
    expect(new Set(SNIPPET_TYPES.map((t) => t.id)).size).toBe(SNIPPET_TYPES.length)
    for (const id of ['article', 'breadcrumb', 'event', 'product', 'recipe', 'video', 'faq', 'howto', 'job', 'local-business', 'review', 'paragraph', 'list', 'table']) expect(SNIPPET_TYPES.some((t) => t.id === id), id).toBe(true)
    expect(SNIPPET_TYPES.find((t) => t.id === 'faq')?.markupOnly).toBe(true)
  })
  it('detects content types and validates markup required properties', () => {
    const facts = parseHtmlFacts(GOOD)
    const d = Object.fromEntries(detectSnippetTypes(facts).map((x) => [x.id, x]))
    expect(d.paragraph.state).toBe('valid')
    expect(d.list.state).toBe('valid')
    expect(d.table.state).toBe('valid')
    expect(d.article.state).toBe('valid')
    expect(d.recipe.state).toBe('missing')
    const broken = parseHtmlFacts('<html><head><script type="application/ld+json">{"@type":"Event","name":"x"}</script></head><body></body></html>')
    const e = detectSnippetTypes(broken).find((x) => x.id === 'event')
    expect(e?.state).toBe('errors')
    expect(e?.missingRequired).toEqual(['startDate', 'location'])
  })
  it('finds types inside @graph and warns on missing recommended properties', () => {
    const f = parseHtmlFacts('<html><head><script type="application/ld+json">{"@graph":[{"@type":"Product","name":"P"}]}</script></head><body></body></html>')
    const p = detectSnippetTypes(f).find((x) => x.id === 'product')
    expect(p?.state).toBe('warnings')
    expect(p?.missingRecommended).toContain('offers')
  })
  it('shows only ticked types and types the page has', () => {
    const detections = detectSnippetTypes(parseHtmlFacts(GOOD))
    const { shown, menu } = panelRows(detections, ['recipe'])
    expect(shown.map((d) => d.id)).toEqual(expect.arrayContaining(['recipe', 'article']))
    expect(shown.some((d) => d.id === 'event')).toBe(false)
    expect(menu).toContain('event')
    expect(menu).not.toContain('recipe')
  })
  it('suggests types from the collection', () => {
    expect(suggestSnippetTypes('products', false)).toContain('product')
    expect(suggestSnippetTypes('posts', true)).toEqual(expect.arrayContaining(['article', 'video']))
  })
})

describe('own page checks (16m, 16n)', () => {
  it('lists every check, passing ones included, and marks the ones that need the site audit as not applicable', () => {
    const rows = ownChecklist(parseHtmlFacts(GOOD), { path: '/good', statusCode: 200, responseMs: 100, inSitemap: true })
    expect(rows.length).toBe(ISSUE_CATALOG.length)
    expect(rows.find((r) => r.id === 'title-missing')?.status).toBe('pass')
    expect(rows.find((r) => r.id === 'orphan')?.status).toBe('na')
    const bad = ownChecklist(parseHtmlFacts(BAD), { path: '/bad', statusCode: 200, responseMs: 100, inSitemap: true })
    expect(bad.find((r) => r.id === 'a11y-image-alt')).toMatchObject({ status: 'fail', group: 'accessibility' })
    expect(ownScores(bad).accessibility).toBeLessThan(ownScores(rows).accessibility as number)
  })
})

describe('PageSpeed checklist (16n)', () => {
  const lighthouse = {
    categories: {
      performance: { auditRefs: [{ id: 'first-contentful-paint' }, { id: 'unused-css-rules' }, { id: 'unsized-images' }] },
      accessibility: { auditRefs: [{ id: 'color-contrast' }, { id: 'focusable-controls' }, { id: 'aria-hidden-body' }] },
      'agentic-browsing': { auditRefs: [{ id: 'llms-txt' }] },
    },
    audits: {
      'first-contentful-paint': { title: 'First Contentful Paint', score: 0.99, scoreDisplayMode: 'numeric', displayValue: '0.4 s' },
      'unused-css-rules': { title: 'Reduce unused CSS', score: 0.2, scoreDisplayMode: 'metricSavings', description: 'Reduce unused rules. [Learn more](https://x.test).' },
      'unsized-images': { title: 'Images have width and height', score: null as number | null, scoreDisplayMode: 'notApplicable' },
      'color-contrast': { title: 'Contrast ok', score: 0.6, scoreDisplayMode: 'binary' },
      'focusable-controls': { title: 'Interactive controls are keyboard focusable', scoreDisplayMode: 'manual', description: 'Check by hand.' },
      'aria-hidden-body': { title: 'No aria-hidden on body', score: 1, scoreDisplayMode: 'binary' },
      'llms-txt': { title: 'llms.txt follows recommendations', score: 0, scoreDisplayMode: 'binary' },
    },
  }
  it('lists every audit of every category, including not applicable and new categories', () => {
    const rows = parseChecklist(lighthouse)
    expect(rows).toHaveLength(7)
    expect(rows.find((r) => r.id === 'unsized-images')?.status).toBe('na')
    expect(rows.find((r) => r.id === 'first-contentful-paint')).toMatchObject({ status: 'pass', value: '0.4 s' })
    expect(rows.find((r) => r.id === 'unused-css-rules')?.status).toBe('fail')
    expect(rows.find((r) => r.id === 'unused-css-rules')?.hint).toBe('Reduce unused rules. Learn more.')
    expect(rows.find((r) => r.id === 'color-contrast')?.status).toBe('warning')
    expect(rows.find((r) => r.id === 'focusable-controls')?.status).toBe('manual')
    expect(rows.find((r) => r.id === 'llms-txt')?.group).toBe('agentic-browsing')
    // Failing rows first inside a group.
    expect(rows.filter((r) => r.group === 'performance')[0].id).toBe('unused-css-rules')
    const groups = groupChecklist(rows)
    expect(groups.map((g) => g.label)).toEqual(['Performance', 'Accessibility', 'Agentic browsing'])
    expect(groups[0].counts).toMatchObject({ fail: 1, pass: 1, na: 1 })
  })
  it('maps statuses and survives junk', () => {
    expect(auditStatus({ score: 0.95, scoreDisplayMode: 'binary' })).toBe('pass')
    expect(auditStatus({ score: 0.49, scoreDisplayMode: 'numeric' })).toBe('fail')
    expect(auditStatus({ scoreDisplayMode: 'informative' })).toBe('info')
    expect(parseChecklist(null)).toEqual([])
    expect(parseChecklist({ categories: { seo: { auditRefs: [{ id: 'nope' }] } }, audits: {} })).toEqual([])
  })
})

describe('audit image sizes and last modified', () => {
  it('reads the Last-Modified header and measures same-site images', async () => {
    const { imageSizes, lastModifiedOf } = await import('@/features/seo/crawl/runner')
    expect(lastModifiedOf('Wed, 21 Oct 2026 07:28:00 GMT')).toBe('2026-10-21T07:28:00.000Z')
    expect(lastModifiedOf('nonsense')).toBeNull()
    const fetchImpl = async (u: string): Promise<Response> => new Response(null, { status: 200, headers: { 'content-length': u.endsWith('a.jpg') ? '2048' : '4096' } })
    const out = await imageSizes('https://x.test', [{ src: '/a.jpg' }, { src: 'https://x.test/b.jpg' }, { src: 'https://other.test/c.jpg' }], fetchImpl)
    expect(out).toEqual({ imageBytes: 6144, largestImageBytes: 4096 })
    expect(await imageSizes('https://x.test', [], fetchImpl)).toEqual({ imageBytes: null, largestImageBytes: null })
  })
})
