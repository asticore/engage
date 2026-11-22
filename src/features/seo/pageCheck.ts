/**
 * The page overview checks (Task 6, items 16m and 16n) that run without a PageSpeed key: load the live page, read its
 * HTML and judge it with the same catalogue as the site audit. Pure parts here; the route does the fetching.
 */

import type { ChecklistRow, CheckStatus } from '@/features/pagespeed/checklist'
import type { HtmlFacts } from './crawl/htmlFacts'
import { ISSUE_CATALOG, pageIssues, type CrawlPage, type IssueDef } from './crawl/issues'

/** Checks that compare pages and so cannot be judged from one page. They show as not applicable here. */
const NEEDS_SITE_AUDIT = new Set(['title-duplicate', 'description-duplicate', 'h1-duplicate', 'duplicate-content', 'orphan', 'too-deep', 'broken-internal-links', 'hreflang-return', 'canonical-broken', 'redirect-chain', 'redirect-loop', 'status-4xx', 'status-5xx'])

const groupOf = (def: IssueDef): string => (def.kind === 'accessibility' ? 'accessibility' : def.kind === 'seo' ? 'seo' : 'best-practices')

export function ownChecklist(facts: HtmlFacts, page: { path: string; statusCode: number; responseMs: number; inSitemap: boolean }): ChecklistRow[] {
  const crawl: CrawlPage<HtmlFacts> = { ...page, redirectTo: null, redirectHops: 0, facts, depth: null, inLinks: 0, outInternal: 0, outExternal: 0, brokenLinks: 0 }
  const failing = new Set(pageIssues(crawl))
  return ISSUE_CATALOG.map((def): ChecklistRow => {
    let status: CheckStatus
    if (NEEDS_SITE_AUDIT.has(def.id)) status = 'na'
    else if (!failing.has(def.id)) status = 'pass'
    else status = def.severity === 'error' ? 'fail' : 'warning'
    const row: ChecklistRow = { id: def.id, group: groupOf(def), title: def.label, status }
    if (status === 'fail' || status === 'warning') row.hint = def.hint
    return row
  })
}

/** The four standard scores are not available from our own checks; this is the share of checks passed per group. */
export function ownScores(rows: ChecklistRow[]): Record<string, number | null> {
  const out: Record<string, number | null> = {}
  for (const group of [...new Set(rows.map((r) => r.group))]) {
    const scored = rows.filter((r) => r.group === group && r.status !== 'na')
    out[group] = scored.length === 0 ? null : Math.round((scored.filter((r) => r.status === 'pass').length / scored.length) * 100)
  }
  return out
}
