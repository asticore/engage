/** Task 21d: sitewide breadcrumb settings (SEO settings, Breadcrumbs group). Pure: raw group in, safe values out. */

export const BREADCRUMB_SEPARATORS = [
  { value: '/', label: '/' },
  { value: '>', label: '>' },
  { value: '›', label: '›' },
  { value: '|', label: '|' },
  { value: '-', label: '-' },
  { value: '•', label: '•' },
] as const

export type BreadcrumbSettings = { separator: string; homeLabel: string; linkLast: boolean; structuredData: boolean }
export const DEFAULT_BREADCRUMBS: BreadcrumbSettings = { separator: '/', homeLabel: 'Home', linkLast: false, structuredData: true }

const allowed = new Set<string>(BREADCRUMB_SEPARATORS.map((s) => s.value))
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})

/** The sitewide settings from the `seo-settings` global (or null), with defaults for anything missing or odd. */
export function resolveBreadcrumbs(settings: unknown): BreadcrumbSettings {
  const g = rec(rec(settings).breadcrumbs)
  const home = typeof g.homeLabel === 'string' ? g.homeLabel.replace(/\s+/g, ' ').trim().slice(0, 40) : ''
  return {
    separator: typeof g.separator === 'string' && allowed.has(g.separator) ? g.separator : DEFAULT_BREADCRUMBS.separator,
    homeLabel: home || DEFAULT_BREADCRUMBS.homeLabel,
    linkLast: g.linkLast === true,
    structuredData: g.structuredData !== false,
  }
}

/** Whether pages should describe their trail as BreadcrumbList structured data. */
export const breadcrumbSchemaOn = (settings: unknown): boolean => resolveBreadcrumbs(settings).structuredData

/** A per-element separator wins over the site one; anything not on the list falls back to the site one. */
export const pickSeparator = (own: unknown, site: string): string => (typeof own === 'string' && allowed.has(own) ? own : site)
