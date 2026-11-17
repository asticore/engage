import { describe, expect, it } from 'vitest'

import { buildSitewideChecks } from '@/features/seo/sitewideChecks'

const ok = { baseUrl: 'https://x.test', robotsText: 'User-agent: *\nDisallow: /admin\n\nSitemap: https://x.test/sitemap.xml\n', sitemapEnabled: true, sitemapCount: 4, titles: ['A', 'B'] }
const by = (r: ReturnType<typeof buildSitewideChecks>, id: string) => r.find((c) => c.id === id)?.status

describe('site-wide checks', () => {
  it('is all green for a healthy site', () => {
    expect(buildSitewideChecks(ok).map((c) => c.status)).toEqual(['good', 'good', 'good', 'good', 'good'])
  })
  it('flags blocked robots, empty sitemap, http, trailing slash and duplicate titles', () => {
    const r = buildSitewideChecks({ ...ok, robotsText: 'User-agent: *\nDisallow: /\n', sitemapCount: 0, baseUrl: 'http://x.test/', titles: ['Home', 'home'] })
    expect(by(r, 'robots')).toBe('bad')
    expect(by(r, 'sitemap')).toBe('bad')
    expect(by(r, 'https')).toBe('bad')
    expect(by(r, 'canonical')).toBe('ok')
    expect(by(r, 'duplicate-titles')).toBe('ok')
  })
  it('treats local addresses as information and a missing Sitemap line as a warning', () => {
    const r = buildSitewideChecks({ ...ok, baseUrl: 'http://localhost:3000', robotsText: 'User-agent: *\nDisallow: /admin\n' })
    expect(by(r, 'https')).toBe('info')
    expect(by(r, 'robots')).toBe('ok')
  })
})
