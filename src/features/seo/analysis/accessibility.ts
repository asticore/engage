/**
 * Accessibility checks that run in the same pass as the SEO and readability checks (Task 6, item 16m).
 * Pure: they read what the analysis already has (headings and images). The checks that need a rendered
 * page (landmarks, labels, link names, ARIA, focus) are in ../crawl/issues.ts and run in the site audit.
 */

import type { AnalysisInput, Check } from './types'

const check = (id: string, label: string, status: Check['status'], message: string): Check => ({ id, label, status, message })

/** Heading levels must not skip: an h2 may be followed by an h3, not by an h4. */
export function headingOrderProblems(headings: { level: number; text: string }[]): string[] {
  const problems: string[] = []
  let previous = 0
  for (const heading of headings) {
    if (previous > 0 && heading.level > previous + 1) problems.push(`A heading level ${heading.level} follows a level ${previous}`)
    previous = heading.level
  }
  return problems
}

export function accessibilityChecks(input: Pick<AnalysisInput, 'headings' | 'images'>): Check[] {
  const checks: Check[] = []
  const order = headingOrderProblems(input.headings)
  checks.push(
    order.length === 0
      ? check('a11y-heading-order', 'Heading order', 'good', 'The headings go down one level at a time.')
      : check('a11y-heading-order', 'Heading order', 'bad', `${order[0]}. Headings should not skip a level, because screen reader users move through the page by headings.`),
  )
  const emptyHeadings = input.headings.filter((h) => !h.text.trim()).length
  if (emptyHeadings > 0) checks.push(check('a11y-heading-empty', 'Empty headings', 'bad', `${emptyHeadings} heading${emptyHeadings === 1 ? ' is' : 's are'} empty. Add text or remove it.`))
  const missingAlt = input.images.filter((i) => !i.alt.trim()).length
  if (input.images.length > 0) {
    checks.push(
      missingAlt === 0
        ? check('a11y-image-alt', 'Image descriptions', 'good', 'Every image has a description (alt text).')
        : check('a11y-image-alt', 'Image descriptions', 'bad', `${missingAlt} of ${input.images.length} images have no alt text. Describe each one, or mark a purely decorative picture as decorative.`),
    )
  }
  return checks
}
