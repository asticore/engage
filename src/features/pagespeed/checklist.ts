/**
 * The full PageSpeed checklist (Task 6, item 16n): every audit of every category in the PageSpeed Insights report,
 * always listed, whether it passes (green), needs work, fails or does not apply (grey, "Not applicable"). Data-driven:
 * the rows come from the response's own category lists, so audits and categories Google adds later appear without a
 * rebuild. Pure; reads the response defensively.
 */

export type CheckStatus = 'pass' | 'warning' | 'fail' | 'na' | 'manual' | 'info'

export type ChecklistRow = {
  /** The audit id, for example `color-contrast`. */
  id: string
  /** The category id: performance, accessibility, best-practices, seo or a new one such as agentic-browsing. */
  group: string
  title: string
  status: CheckStatus
  /** The measured value where one exists, for example "1.2 s". */
  value?: string
  /** A short fix hint (kept for rows that need attention only). */
  hint?: string
}

type Loose = Record<string, unknown>
const obj = (value: unknown): Loose | null => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Loose) : null)
const str = (value: unknown): string => (typeof value === 'string' ? value : '')
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)

const clean = (value: unknown, max: number): string => {
  const text = str(value)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[<>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? `${text.slice(0, max - 1)}.` : text
}

/** The label of a category group, with the four standard ones named the way the report names them. */
export const GROUP_LABELS: Record<string, string> = {
  performance: 'Performance',
  accessibility: 'Accessibility',
  'best-practices': 'Best practices',
  seo: 'SEO',
  'agentic-browsing': 'Agentic browsing',
}

export const groupLabel = (group: string): string =>
  GROUP_LABELS[group] ?? group.replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase())

/** Maps one Lighthouse audit to a status. Scores of 0.9 or more pass, 0.5 to 0.89 need work, below 0.5 fail. */
export function auditStatus(audit: Loose): CheckStatus {
  const mode = str(audit.scoreDisplayMode)
  if (mode === 'notApplicable') return 'na'
  if (mode === 'manual') return 'manual'
  if (mode === 'informative') return 'info'
  if (mode === 'error') return 'warning'
  const score = num(audit.score)
  if (score === null) return 'info'
  if (score >= 0.9) return 'pass'
  if (score >= 0.5) return 'warning'
  return 'fail'
}

const MAX_ROWS = 400

/** Every audit of every category in the report, failing first. Returns an empty list when the response has none. */
export function parseChecklist(lighthouse: unknown): ChecklistRow[] {
  const root = obj(lighthouse)
  const categories = obj(root?.categories)
  const audits = obj(root?.audits)
  if (!categories || !audits) return []
  const rows: ChecklistRow[] = []
  const seen = new Set<string>()
  for (const [group, category] of Object.entries(categories)) {
    const refs = obj(category)?.auditRefs
    if (!Array.isArray(refs)) continue
    for (const ref of refs) {
      const id = str(obj(ref)?.id)
      const audit = obj(audits[id])
      const key = `${group}:${id}`
      if (!id || !audit || seen.has(key)) continue
      seen.add(key)
      const status = auditStatus(audit)
      const row: ChecklistRow = { id: id.slice(0, 60), group: group.slice(0, 40), title: clean(audit.title, 90), status }
      const value = clean(audit.displayValue, 40)
      if (value) row.value = value
      const numeric = num(audit.numericValue)
      if (!value && numeric !== null && str(audit.scoreDisplayMode) === 'numeric' && str(audit.numericUnit) === 'millisecond') {
        row.value = numeric >= 1000 ? `${(numeric / 1000).toFixed(1)} s` : `${Math.round(numeric)} ms`
      }
      if (status === 'fail' || status === 'warning' || status === 'manual') {
        const hint = clean(audit.description, 160)
        if (hint) row.hint = hint
      }
      rows.push(row)
      if (rows.length >= MAX_ROWS) return sortChecklist(rows)
    }
  }
  return sortChecklist(rows)
}

const ORDER: Record<CheckStatus, number> = { fail: 0, warning: 1, manual: 2, info: 3, pass: 4, na: 5 }

/** Keeps the category order of the report, and within a category lists failing rows first. */
export function sortChecklist(rows: ChecklistRow[]): ChecklistRow[] {
  const groups = [...new Set(rows.map((r) => r.group))]
  return [...rows].sort((a, b) => groups.indexOf(a.group) - groups.indexOf(b.group) || ORDER[a.status] - ORDER[b.status])
}

export type ChecklistGroup = { group: string; label: string; rows: ChecklistRow[]; counts: Record<CheckStatus, number> }

export function groupChecklist(rows: ChecklistRow[]): ChecklistGroup[] {
  const out = new Map<string, ChecklistGroup>()
  for (const row of rows) {
    const entry = out.get(row.group) ?? { group: row.group, label: groupLabel(row.group), rows: [], counts: { pass: 0, warning: 0, fail: 0, na: 0, manual: 0, info: 0 } }
    entry.rows.push(row)
    entry.counts[row.status] += 1
    out.set(row.group, entry)
  }
  return [...out.values()]
}

/** The text shown for a status. */
export const STATUS_WORD: Record<CheckStatus, string> = { pass: 'Pass', warning: 'Warning', fail: 'Fail', na: 'Not applicable', manual: 'Check by hand', info: 'Info' }
