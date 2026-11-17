import type { Status } from './analysis/types'

/**
 * Task 16h: traffic lights for the checks that cover the whole site: robots.txt, the sitemap, HTTPS, the
 * canonical address and duplicate titles. Pure; the audit route gathers the inputs.
 */
export type SitewideCheck = { id: string; label: string; status: Status; message: string }

export type SitewideInput = {
  baseUrl: string
  /** The robots.txt body, or null when the SEO feature is off. */
  robotsText: string | null
  sitemapEnabled: boolean
  /** Number of sitemap entries, or null when the SEO feature is off. */
  sitemapCount: number | null
  /** Title that search results will show, per published item. */
  titles: string[]
}

const isLocal = (url: string): boolean => /^https?:\/\/(localhost|127\.|\[::1\])/i.test(url)

export function robotsCheck(robotsText: string | null, sitemapEnabled: boolean): SitewideCheck {
  const label = 'robots.txt'
  if (robotsText === null) return { id: 'robots', label, status: 'ok', message: 'The SEO feature is off, so no robots.txt is served.' }
  const blocksAll = /user-agent\s*:\s*\*[\s\S]*?^\s*disallow\s*:\s*\/\s*$/im.test(robotsText)
  if (blocksAll) return { id: 'robots', label, status: 'bad', message: 'robots.txt blocks the whole site from search engines. Turn on indexing in SEO settings.' }
  if (sitemapEnabled && !/^\s*sitemap\s*:/im.test(robotsText)) return { id: 'robots', label, status: 'ok', message: 'robots.txt has no Sitemap line.' }
  return { id: 'robots', label, status: 'good', message: 'robots.txt is served and lets search engines in.' }
}

export function sitemapCheck(enabled: boolean, count: number | null): SitewideCheck {
  const label = 'Sitemap'
  if (!enabled) return { id: 'sitemap', label, status: 'ok', message: 'The sitemap is switched off in SEO settings.' }
  if (count === null) return { id: 'sitemap', label, status: 'ok', message: 'The SEO feature is off, so no sitemap is served.' }
  if (count === 0) return { id: 'sitemap', label, status: 'bad', message: 'The sitemap has no addresses in it.' }
  return { id: 'sitemap', label, status: 'good', message: `The sitemap lists ${count} address${count === 1 ? '' : 'es'}.` }
}

export function httpsCheck(baseUrl: string): SitewideCheck {
  const label = 'HTTPS'
  if (!baseUrl) return { id: 'https', label, status: 'bad', message: 'No site address is set.' }
  if (baseUrl.startsWith('https://')) return { id: 'https', label, status: 'good', message: 'The site address uses HTTPS.' }
  if (isLocal(baseUrl)) return { id: 'https', label, status: 'info', message: 'This is a local address, which is fine for testing.' }
  return { id: 'https', label, status: 'bad', message: 'The site address uses plain HTTP. Set SITE_URL to the https address.' }
}

export function canonicalCheck(baseUrl: string): SitewideCheck {
  const label = 'Canonical address'
  if (!baseUrl || isLocal(baseUrl)) return { id: 'canonical', label, status: 'ok', message: 'The public site address is not set, so canonical links point at a test address.' }
  if (/\/$/.test(baseUrl)) return { id: 'canonical', label, status: 'ok', message: 'The site address ends with a slash. Remove it so canonical links do not double up.' }
  return { id: 'canonical', label, status: 'good', message: `Canonical links use ${baseUrl}.` }
}

export function duplicateTitlesCheck(titles: string[]): SitewideCheck {
  const label = 'Duplicate titles'
  const seen = new Map<string, number>()
  for (const t of titles) {
    const key = t.trim().toLowerCase()
    if (key) seen.set(key, (seen.get(key) ?? 0) + 1)
  }
  const dupes = [...seen.values()].filter((n) => n > 1)
  if (dupes.length === 0) return { id: 'duplicate-titles', label, status: 'good', message: 'Every title is unique.' }
  const items = dupes.reduce((a, b) => a + b, 0)
  return { id: 'duplicate-titles', label, status: 'ok', message: `${dupes.length} title${dupes.length === 1 ? ' is' : 's are'} used more than once (${items} items). Give each its own SEO title.` }
}

export function buildSitewideChecks(input: SitewideInput): SitewideCheck[] {
  return [
    robotsCheck(input.robotsText, input.sitemapEnabled),
    sitemapCheck(input.sitemapEnabled, input.sitemapCount),
    httpsCheck(input.baseUrl),
    canonicalCheck(input.baseUrl),
    duplicateTitlesCheck(input.titles),
  ]
}
