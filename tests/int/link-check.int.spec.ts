import { describe, expect, it } from 'vitest'

import { collectLinks, judgeStatus, normaliseHref, summariseLinks } from '@/features/seo/linkCheck'
import { fetchTarget } from '@/features/seo/linkCheckRun'

const doc = (id: number, title: string, hrefs: string[]) => ({
  collection: 'pages',
  doc: { id, title, slug: title.toLowerCase(), content: { root: { type: 'root', children: [{ type: 'paragraph', children: hrefs.map((h) => ({ type: 'link', fields: { url: h }, children: [{ type: 'text', text: 'x' }] })) }] } } },
})

describe('broken link checker', () => {
  it('normalises links and skips mail, phone and anchors', () => {
    expect(normaliseHref('mailto:a@b.co')).toBeNull()
    expect(normaliseHref('#top')).toBeNull()
    expect(normaliseHref('about#team')).toEqual({ href: '/about', internal: true })
    expect(normaliseHref('//x.test/a')).toEqual({ href: 'https://x.test/a', internal: false })
    expect(normaliseHref('https://x.test/a#b')).toEqual({ href: 'https://x.test/a', internal: false })
  })
  it('collects each link once with the pages that hold it', () => {
    const links = collectLinks([doc(1, 'A', ['/gone', 'https://x.test/']), doc(2, 'B', ['/gone'])])
    const gone = links.find((l) => l.href === '/gone')
    expect(gone?.sources.map((s) => s.title)).toEqual(['A', 'B'])
    expect(links.find((l) => l.href === 'https://x.test/')?.internal).toBe(false)
  })
  it('refuses private, local and credentialed addresses', () => {
    const origin = 'https://site.test'
    expect(fetchTarget('/about', origin)).toBe('https://site.test/about')
    expect(fetchTarget('http://localhost/x', origin)).toBeNull()
    expect(fetchTarget('http://169.254.169.254/latest', origin)).toBeNull()
    expect(fetchTarget('https://user:pw@x.test/', origin)).toBeNull()
    expect(fetchTarget('https://x.test:8443/', origin)).toBeNull()
    expect(fetchTarget('ftp://x.test/', origin)).toBeNull()
    expect(fetchTarget('https://example.com/ok', origin)).toBe('https://example.com/ok')
  })
  it('judges replies', () => {
    expect(judgeStatus(200)).toBe('ok')
    expect(judgeStatus(301)).toBe('redirect')
    expect(judgeStatus(404)).toBe('broken')
    expect(judgeStatus(410)).toBe('broken')
    expect(judgeStatus(403)).toBe('blocked')
    expect(judgeStatus(503)).toBe('unknown')
    expect(judgeStatus(0)).toBe('unknown')
  })
  it('summarises results', () => {
    const s = summariseLinks([
      { href: 'a', status: 200, verdict: 'ok' },
      { href: 'b', status: 404, verdict: 'broken' },
      { href: 'c', status: 301, verdict: 'redirect' },
      { href: 'd', status: 403, verdict: 'blocked' },
    ])
    expect(s).toEqual({ checked: 4, broken: 1, redirects: 1, unknown: 1 })
  })
})
