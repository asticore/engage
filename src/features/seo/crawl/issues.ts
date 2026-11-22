/**
 * The site audit checks (Task 6, items 16m and 16o). A data-driven catalogue: every check has an id, a kind
 * (SEO, Accessibility or Technical), a severity and a fix hint, and a pure test. Page checks read one crawled
 * page; site checks compare pages (duplicates, orphans, depth). Add a row to the catalogue to add a check.
 */

import { headingOrderProblems } from '../analysis/accessibility'
import type { HtmlFacts } from './htmlFacts'

export type IssueKind = 'seo' | 'accessibility' | 'technical'
export type Severity = 'error' | 'warning' | 'notice'

/** The part of a page's facts the link graph and the site checks need; this is also what a crawl stores. */
export type SlimFacts = Pick<HtmlFacts, 'robots' | 'canonical' | 'hreflang' | 'title' | 'metaDescription' | 'wordCount' | 'hash' | 'headings'> & { links: { href: string }[] }

export type CrawlPage<F extends SlimFacts = SlimFacts> = {
  path: string
  statusCode: number
  responseMs: number
  /** Where a redirect (3xx) points; null otherwise. */
  redirectTo: string | null
  /** The redirect chain length followed (0 for none). */
  redirectHops: number
  inSitemap: boolean
  /** The page's HTML facts; null when the page could not be read. */
  facts: F | null
  /** Filled in by `linkGraph`. */
  depth: number | null
  inLinks: number
  outInternal: number
  outExternal: number
  brokenLinks: number
}

export type IssueDef = {
  id: string
  kind: IssueKind
  severity: Severity
  label: string
  hint: string
}

const DEFS: IssueDef[] = [
  // Status and indexing
  { id: 'status-4xx', kind: 'technical', severity: 'error', label: 'Page returns a 4xx error', hint: 'Fix the page, or redirect its address to a page that works.' },
  { id: 'status-5xx', kind: 'technical', severity: 'error', label: 'Page returns a 5xx error', hint: 'The server failed on this page. Check the page and try again.' },
  { id: 'redirect-chain', kind: 'technical', severity: 'warning', label: 'Redirect chain', hint: 'Point the first address straight at the final page.' },
  { id: 'redirect-loop', kind: 'technical', severity: 'error', label: 'Redirect loop', hint: 'The address redirects back to itself. Change one of the redirects.' },
  { id: 'noindex-in-sitemap', kind: 'seo', severity: 'warning', label: 'Hidden from search but listed in the sitemap', hint: 'Remove the noindex, or take the page out of the sitemap.' },
  { id: 'missing-from-sitemap', kind: 'seo', severity: 'notice', label: 'Indexable page missing from the sitemap', hint: 'Add the page to the sitemap so search engines find it.' },
  { id: 'canonical-elsewhere', kind: 'seo', severity: 'notice', label: 'Canonical points to another page', hint: 'Check the canonical address is meant to be the original of this page.' },
  { id: 'canonical-missing', kind: 'seo', severity: 'notice', label: 'No canonical address', hint: 'Add a canonical link so duplicates of the page are not indexed.' },
  { id: 'canonical-broken', kind: 'seo', severity: 'error', label: 'Canonical points to a missing or redirecting page', hint: 'Point the canonical at a live page.' },
  // Titles and descriptions
  { id: 'title-missing', kind: 'seo', severity: 'error', label: 'Title is missing', hint: 'Add a title of 30 to 60 characters.' },
  { id: 'title-short', kind: 'seo', severity: 'warning', label: 'Title is too short', hint: 'Use at least 30 characters so the title describes the page.' },
  { id: 'title-long', kind: 'seo', severity: 'warning', label: 'Title is too long', hint: 'Keep the title under 60 characters (about 580 pixels) so it is not cut off.' },
  { id: 'title-duplicate', kind: 'seo', severity: 'error', label: 'Title is used on other pages', hint: 'Give each page its own title.' },
  { id: 'description-missing', kind: 'seo', severity: 'warning', label: 'Meta description is missing', hint: 'Add a description of 70 to 160 characters.' },
  { id: 'description-short', kind: 'seo', severity: 'notice', label: 'Meta description is too short', hint: 'Use at least 70 characters.' },
  { id: 'description-long', kind: 'seo', severity: 'notice', label: 'Meta description is too long', hint: 'Keep it under 160 characters so it is not cut off.' },
  { id: 'description-duplicate', kind: 'seo', severity: 'warning', label: 'Meta description is used on other pages', hint: 'Write a description for each page.' },
  // Headings and content
  { id: 'h1-missing', kind: 'seo', severity: 'error', label: 'No H1 heading', hint: 'Give the page one H1 heading that says what it is about.' },
  { id: 'h1-multiple', kind: 'seo', severity: 'warning', label: 'More than one H1 heading', hint: 'Use one H1 and make the others H2 or lower.' },
  { id: 'h1-duplicate', kind: 'seo', severity: 'notice', label: 'H1 heading is used on other pages', hint: 'Give each page its own H1.' },
  { id: 'thin-content', kind: 'seo', severity: 'warning', label: 'Thin content (under 200 words)', hint: 'Add useful text, or mark the page noindex if it is only a shell.' },
  { id: 'duplicate-content', kind: 'seo', severity: 'error', label: 'Same content as another page', hint: 'Merge the pages, rewrite one, or set a canonical address.' },
  // Links
  { id: 'broken-internal-links', kind: 'technical', severity: 'error', label: 'Links to missing pages on this site', hint: 'Fix or remove the broken links.' },
  { id: 'orphan', kind: 'seo', severity: 'warning', label: 'No other page links here (orphan)', hint: 'Link to the page from a related page or the menu.' },
  { id: 'too-deep', kind: 'seo', severity: 'notice', label: 'More than 3 clicks from the home page', hint: 'Link to the page from a page closer to the home page.' },
  { id: 'link-text-generic', kind: 'seo', severity: 'notice', label: 'Links with non-descriptive text', hint: 'Say where the link goes instead of "click here" or "read more".' },
  // Images
  { id: 'image-alt-missing', kind: 'seo', severity: 'warning', label: 'Images without alt text', hint: 'Describe each image. Mark decorative pictures as decorative.' },
  { id: 'image-size-missing', kind: 'technical', severity: 'notice', label: 'Images without width and height', hint: 'Set the size so the page does not jump while loading.' },
  { id: 'image-format', kind: 'technical', severity: 'notice', label: 'Images that are not WebP or AVIF', hint: 'Use WebP or AVIF for smaller files.' },
  // Structured data and social
  { id: 'schema-missing', kind: 'seo', severity: 'notice', label: 'No structured data', hint: 'Add schema markup that fits the page (see the snippet panel).' },
  { id: 'schema-invalid', kind: 'seo', severity: 'error', label: 'Structured data cannot be read', hint: 'The JSON-LD on the page is not valid JSON. Fix the markup.' },
  { id: 'og-missing', kind: 'seo', severity: 'notice', label: 'Open Graph tags missing', hint: 'Add og:title, og:description and og:image so shares look right.' },
  { id: 'hreflang-return', kind: 'seo', severity: 'warning', label: 'hreflang has no return link', hint: 'Every language page must link back to the page that links to it.' },
  // Technical
  { id: 'mixed-content', kind: 'technical', severity: 'error', label: 'Loads http resources on an https page', hint: 'Change every http:// address to https://.' },
  { id: 'slow-response', kind: 'technical', severity: 'warning', label: 'Slow response (over 1.5 seconds)', hint: 'See the speed settings and the PageSpeed panel.' },
  { id: 'large-html', kind: 'technical', severity: 'notice', label: 'Large HTML (over 200 KB)', hint: 'Reduce the page size: fewer sections, lazy load long lists.' },
  { id: 'viewport-missing', kind: 'technical', severity: 'error', label: 'No viewport tag', hint: 'Add <meta name="viewport"> so the page works on phones.' },
  { id: 'lang-missing', kind: 'accessibility', severity: 'error', label: 'No language set on the page', hint: 'Set the lang attribute on the html tag.' },
  { id: 'favicon-missing', kind: 'technical', severity: 'notice', label: 'No favicon', hint: 'Upload a site icon in the settings.' },
  { id: 'charset-missing', kind: 'technical', severity: 'warning', label: 'No character set or doctype', hint: 'Add a UTF-8 charset meta tag and the html doctype.' },
  { id: 'url-long', kind: 'seo', severity: 'notice', label: 'Address is too long (over 115 characters)', hint: 'Shorten the address.' },
  { id: 'url-format', kind: 'seo', severity: 'notice', label: 'Address has capitals, underscores or parameters', hint: 'Use lower-case words separated by hyphens.' },
  // Accessibility (item 16m)
  { id: 'a11y-heading-order', kind: 'accessibility', severity: 'warning', label: 'Heading levels skip', hint: 'Go down one heading level at a time.' },
  { id: 'a11y-no-main', kind: 'accessibility', severity: 'warning', label: 'No main landmark', hint: 'Wrap the page content in a main element.' },
  { id: 'a11y-multiple-main', kind: 'accessibility', severity: 'warning', label: 'More than one main landmark', hint: 'A page has one main landmark.' },
  { id: 'a11y-image-alt', kind: 'accessibility', severity: 'error', label: 'Images have no alt attribute', hint: 'Add alt text, or an empty alt for a decorative picture.' },
  { id: 'a11y-link-name', kind: 'accessibility', severity: 'error', label: 'Links with no name', hint: 'Give every link text or an aria-label.' },
  { id: 'a11y-button-name', kind: 'accessibility', severity: 'error', label: 'Buttons with no name', hint: 'Give every button text or an aria-label.' },
  { id: 'a11y-input-label', kind: 'accessibility', severity: 'error', label: 'Form fields with no label', hint: 'Connect a label to each field.' },
  { id: 'a11y-iframe-title', kind: 'accessibility', severity: 'warning', label: 'Frames with no title', hint: 'Add a title attribute to each iframe.' },
  { id: 'a11y-duplicate-id', kind: 'accessibility', severity: 'error', label: 'The same id is used twice', hint: 'Ids must be unique on a page.' },
  { id: 'a11y-tabindex', kind: 'accessibility', severity: 'warning', label: 'Positive tabindex values', hint: 'Remove tabindex values above 0; they break the tab order.' },
  { id: 'a11y-aria-hidden-focus', kind: 'accessibility', severity: 'error', label: 'Focusable items inside aria-hidden', hint: 'Do not hide focusable controls from screen readers.' },
  { id: 'a11y-aria-role', kind: 'accessibility', severity: 'error', label: 'Invalid ARIA role', hint: 'Use a role from the ARIA list.' },
  { id: 'a11y-skip-link', kind: 'accessibility', severity: 'notice', label: 'No skip to content link', hint: 'Add a first link that jumps to the main content.' },
]

export const ISSUE_CATALOG: readonly IssueDef[] = DEFS
export const ISSUE_BY_ID: Readonly<Record<string, IssueDef>> = Object.fromEntries(DEFS.map((d) => [d.id, d]))

const GENERIC_LINK_TEXT = /^(click here|here|read more|more|learn more|link|this link|click|details)$/i

/** A rough pixel width for a title in Google's result font (about 9 px per character, narrower for i, l, t, f). */
export function titlePixelWidth(title: string): number {
  let width = 0
  for (const ch of title) width += /[il.,;:'|!]/.test(ch) ? 4 : /[tfjr ]/.test(ch) ? 6 : /[mwMW]/.test(ch) ? 14 : /[A-Z]/.test(ch) ? 11 : 9
  return width
}

export const TITLE_MIN = 30
export const TITLE_MAX = 60
export const DESCRIPTION_MIN = 70
export const DESCRIPTION_MAX = 160
export const THIN_WORDS = 200
export const SLOW_MS = 1500
export const LARGE_HTML_BYTES = 200 * 1024
export const MAX_DEPTH = 3
export const MAX_URL_LENGTH = 115

const isModernImage = (src: string): boolean => /\.(webp|avif|svg)(\?|$)/i.test(src) || /^data:/i.test(src) || !/\.(jpe?g|png|gif|bmp)(\?|$)/i.test(src)

/** The ids of the checks one page fails by itself. Pure; comparisons between pages are in `siteIssues`. */
export function pageIssues(page: CrawlPage<HtmlFacts>): string[] {
  const out: string[] = []
  const code = page.statusCode
  if (code >= 400 && code < 500) out.push('status-4xx')
  if (code >= 500) out.push('status-5xx')
  if (page.redirectHops > 1) out.push('redirect-chain')
  if (page.redirectHops >= 10) out.push('redirect-loop')
  if (page.path.length > MAX_URL_LENGTH) out.push('url-long')
  if (/[A-Z_?]/.test(page.path)) out.push('url-format')
  if (page.responseMs > SLOW_MS) out.push('slow-response')
  if (page.brokenLinks > 0) out.push('broken-internal-links')
  const f = page.facts
  if (!f || code >= 300) return out

  const noindex = /noindex/.test(f.robots)
  if (noindex && page.inSitemap) out.push('noindex-in-sitemap')
  if (!noindex && !page.inSitemap) out.push('missing-from-sitemap')
  if (f.canonical === null) out.push('canonical-missing')
  else {
    const canonical = f.canonical.replace(/^https?:\/\/[^/]+/i, '').replace(/\/$/, '') || '/'
    const own = page.path.split('?')[0].replace(/\/$/, '') || '/'
    if (canonical !== own) out.push('canonical-elsewhere')
  }
  const title = f.title.trim()
  if (!title) out.push('title-missing')
  else if (title.length < TITLE_MIN) out.push('title-short')
  else if (title.length > TITLE_MAX || titlePixelWidth(title) > 580) out.push('title-long')
  const description = (f.metaDescription ?? '').trim()
  if (!description) out.push('description-missing')
  else if (description.length < DESCRIPTION_MIN) out.push('description-short')
  else if (description.length > DESCRIPTION_MAX) out.push('description-long')
  const h1s = f.headings.filter((h) => h.level === 1).length
  if (h1s === 0) out.push('h1-missing')
  if (h1s > 1) out.push('h1-multiple')
  if (f.wordCount < THIN_WORDS && !noindex) out.push('thin-content')
  if (f.images.some((i) => !i.decorative && i.alt === null)) out.push('image-alt-missing')
  if (f.images.some((i) => !(i.width && i.height))) out.push('image-size-missing')
  if (f.images.some((i) => !isModernImage(i.src))) out.push('image-format')
  if (f.jsonLd.length === 0 && f.jsonLdInvalid === 0) out.push('schema-missing')
  if (f.jsonLdInvalid > 0) out.push('schema-invalid')
  if (!f.og['og:title'] || !f.og['og:image']) out.push('og-missing')
  if (f.mixedContent > 0) out.push('mixed-content')
  if (f.bytes > LARGE_HTML_BYTES) out.push('large-html')
  if (!f.viewport) out.push('viewport-missing')
  if (!f.lang) out.push('lang-missing')
  if (!f.favicon) out.push('favicon-missing')
  if (!f.charset || !f.doctype) out.push('charset-missing')
  if (f.links.some((l) => GENERIC_LINK_TEXT.test(l.text.trim()) && !l.label)) out.push('link-text-generic')

  // Accessibility, same pass (16m).
  if (headingOrderProblems(f.headings).length > 0) out.push('a11y-heading-order')
  if (f.landmarks.main === 0) out.push('a11y-no-main')
  if (f.landmarks.main > 1) out.push('a11y-multiple-main')
  if (f.images.some((i) => i.alt === null && !i.decorative)) out.push('a11y-image-alt')
  if (f.links.some((l) => !l.text.trim() && !l.label && !l.hasImageWithAlt)) out.push('a11y-link-name')
  if (f.buttonsWithoutName > 0) out.push('a11y-button-name')
  if (f.inputsWithoutLabel > 0) out.push('a11y-input-label')
  if (f.iframesWithoutTitle > 0) out.push('a11y-iframe-title')
  if (f.duplicateIds.length > 0) out.push('a11y-duplicate-id')
  if (f.positiveTabindex > 0) out.push('a11y-tabindex')
  if (f.ariaHiddenFocusable > 0) out.push('a11y-aria-hidden-focus')
  if (f.badAriaRoles.length > 0) out.push('a11y-aria-role')
  if (!f.skipLink && f.links.length > 10) out.push('a11y-skip-link')
  return out
}

const normPath = (path: string): string => {
  const clean = path.split('#')[0].split('?')[0]
  return clean.length > 1 ? clean.replace(/\/$/, '') : clean || '/'
}

/** Which internal path a link points at, or null for external, mail and fragment links. */
export function internalTarget(href: string, origin: string): string | null {
  const raw = href.trim()
  if (!raw || raw.startsWith('#') || /^(mailto|tel|sms|javascript|data):/i.test(raw)) return null
  try {
    const url = new URL(raw, origin)
    if (url.origin !== new URL(origin).origin) return null
    return normPath(url.pathname)
  } catch {
    return null
  }
}

/**
 * Fills links in and out, click depth from the home page and broken internal links on every page, using the
 * pages crawled. Pure; mutates and returns the same array.
 */
export function linkGraph(pages: CrawlPage[], origin: string): CrawlPage[] {
  const byPath = new Map(pages.map((p) => [normPath(p.path), p]))
  const outs = new Map<string, Set<string>>()
  for (const p of pages) {
    p.inLinks = 0
    p.brokenLinks = 0
    p.outExternal = 0
    p.outInternal = 0
    p.depth = null
  }
  for (const p of pages) {
    const own = normPath(p.path)
    const targets = new Set<string>()
    for (const link of p.facts?.links ?? []) {
      const target = internalTarget(link.href, origin)
      if (target === null) {
        if (/^https?:|^\/\//i.test(link.href.trim())) p.outExternal += 1
        continue
      }
      if (target === own) continue
      p.outInternal += 1
      targets.add(target)
      const found = byPath.get(target)
      if (found) {
        // A page with a 4xx or 5xx status is a broken target.
        if (found.statusCode >= 400) p.brokenLinks += 1
      }
    }
    outs.set(own, targets)
    for (const target of targets) {
      const found = byPath.get(target)
      if (found) found.inLinks += 1
    }
  }
  // Breadth first from the home page.
  const home = byPath.get('/')
  if (home) {
    home.depth = 0
    const queue = ['/']
    while (queue.length > 0) {
      const current = queue.shift() as string
      const depth = byPath.get(current)?.depth ?? 0
      for (const target of outs.get(current) ?? []) {
        const next = byPath.get(target)
        if (next && next.depth === null) {
          next.depth = depth + 1
          queue.push(target)
        }
      }
    }
  }
  return pages
}

/** Checks that compare pages: duplicates, orphans, depth, canonical targets and hreflang return links. Keyed by page path. */
export function siteIssues(pages: CrawlPage[], origin: string): Map<string, string[]> {
  const out = new Map<string, string[]>()
  const add = (path: string, id: string): void => {
    const list = out.get(path) ?? []
    if (!list.includes(id)) list.push(id)
    out.set(path, list)
  }
  const live = pages.filter((p) => p.facts && p.statusCode < 300)
  const group = (pick: (p: CrawlPage) => string): Map<string, CrawlPage[]> => {
    const map = new Map<string, CrawlPage[]>()
    for (const p of live) {
      if (/noindex/.test(p.facts?.robots ?? '')) continue
      const key = pick(p).trim().toLowerCase()
      if (!key) continue
      map.set(key, [...(map.get(key) ?? []), p])
    }
    return map
  }
  for (const [, list] of group((p) => p.facts?.title ?? '')) if (list.length > 1) for (const p of list) add(p.path, 'title-duplicate')
  for (const [, list] of group((p) => p.facts?.metaDescription ?? '')) if (list.length > 1) for (const p of list) add(p.path, 'description-duplicate')
  for (const [, list] of group((p) => p.facts?.headings.find((h) => h.level === 1)?.text ?? '')) if (list.length > 1) for (const p of list) add(p.path, 'h1-duplicate')
  for (const [, list] of group((p) => ((p.facts?.wordCount ?? 0) >= 50 ? (p.facts?.hash ?? '') : ''))) if (list.length > 1) for (const p of list) add(p.path, 'duplicate-content')

  const byPath = new Map(pages.map((p) => [normPath(p.path), p]))
  for (const p of live) {
    const own = normPath(p.path)
    if (own !== '/' && p.inLinks === 0 && !/noindex/.test(p.facts?.robots ?? '')) add(p.path, 'orphan')
    if (p.depth !== null && p.depth > MAX_DEPTH) add(p.path, 'too-deep')
    const canonical = p.facts?.canonical
    if (canonical) {
      const target = internalTarget(canonical, origin)
      const found = target ? byPath.get(target) : null
      if (found && (found.statusCode >= 300 || !found.facts)) add(p.path, 'canonical-broken')
    }
    for (const alt of p.facts?.hreflang ?? []) {
      const target = internalTarget(alt.href, origin)
      const found = target && target !== own ? byPath.get(target) : null
      if (found?.facts && !found.facts.hreflang.some((back) => internalTarget(back.href, origin) === own)) {
        add(p.path, 'hreflang-return')
        break
      }
    }
  }
  return out
}

export type HealthCounts = { errors: number; warnings: number; notices: number }

/** Site health score 0 to 100 (like the Semrush health score): the share of pages without an error, weighted down by warnings. */
export function healthScore(issuesByPage: string[][]): { score: number } & HealthCounts {
  const counts: HealthCounts = { errors: 0, warnings: 0, notices: 0 }
  if (issuesByPage.length === 0) return { score: 100, ...counts }
  let weight = 0
  for (const ids of issuesByPage) {
    let pageErrors = 0
    let pageWarnings = 0
    for (const id of ids) {
      const severity = ISSUE_BY_ID[id]?.severity
      if (severity === 'error') {
        counts.errors += 1
        pageErrors += 1
      } else if (severity === 'warning') {
        counts.warnings += 1
        pageWarnings += 1
      } else if (severity === 'notice') counts.notices += 1
    }
    weight += pageErrors > 0 ? 0 : pageWarnings > 0 ? 0.6 : 1
  }
  return { score: Math.round((weight / issuesByPage.length) * 100), ...counts }
}
