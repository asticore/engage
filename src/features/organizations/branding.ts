import { sanitizeColourValue } from '@/features/themeStyles/sanitize'

import { MAX_METADATA_BYTES } from './policy'

/**
 * Company theming and portal layout (Task 22c). Pure.
 *
 * Both live inside the organisation's own `metadata` JSON under the keys `branding` and
 * `layout`, so no table was added: the data is scoped to one company by construction and
 * cannot reach another company's pages or the site-wide theme (src/features/themeStyles).
 * Every value is validated here on the way in and again on the way out, and the stylesheet
 * is built only from validated colours and fixed font stacks, so nothing a company types
 * can break out of the style element.
 */

export const BRANDING_KEY = 'branding'
export const LAYOUT_KEY = 'layout'

export const BRANDING_COLOUR_FIELDS = ['primary', 'accent', 'background', 'text'] as const
export type BrandingColourField = (typeof BRANDING_COLOUR_FIELDS)[number]

/** Fixed, safe font stacks. A company picks a name, never a raw font-family string. */
export const BRANDING_FONTS = {
  default: '',
  system: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  rounded: 'ui-rounded, "Hiragino Maru Gothic ProN", Quicksand, "Segoe UI", sans-serif',
} as const
export type BrandingFont = keyof typeof BRANDING_FONTS
export const BRANDING_FONT_NAMES = Object.keys(BRANDING_FONTS) as BrandingFont[]

export type Branding = {
  primary: string
  accent: string
  background: string
  text: string
  headingFont: BrandingFont
  bodyFont: BrandingFont
}

/** The sections of the company portal page, in their default order. */
export const PORTAL_SECTIONS = ['members', 'teams', 'content', 'invitations', 'roles', 'details'] as const
export type PortalSection = (typeof PORTAL_SECTIONS)[number]

export type PortalLayout = { order: PortalSection[]; hidden: PortalSection[] }

export const EMPTY_BRANDING: Branding = { primary: '', accent: '', background: '', text: '', headingFont: 'default', bodyFont: 'default' }
export const DEFAULT_LAYOUT: PortalLayout = { order: [...PORTAL_SECTIONS], hidden: [] }

/** Details can never be hidden, so a company cannot lock itself out of this very form. */
const ALWAYS_SHOWN: readonly PortalSection[] = ['details']

const literal = (value: unknown): string => {
  const colour = sanitizeColourValue(value)
  return colour.startsWith('@') ? '' : colour
}

const font = (value: unknown): BrandingFont => (typeof value === 'string' && (BRANDING_FONT_NAMES as string[]).includes(value) ? (value as BrandingFont) : 'default')

const isSection = (value: unknown): value is PortalSection => typeof value === 'string' && (PORTAL_SECTIONS as readonly string[]).includes(value)

/** Branding from untrusted input (a form, or stored metadata). Anything invalid becomes empty, meaning "use the site's look". */
export function sanitiseBranding(input: unknown): Branding {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {}
  return {
    primary: literal(raw.primary),
    accent: literal(raw.accent),
    background: literal(raw.background),
    text: literal(raw.text),
    headingFont: font(raw.headingFont),
    bodyFont: font(raw.bodyFont),
  }
}

/** Layout from untrusted input. Unknown, repeated and missing sections are repaired, so the page always shows every section that is not hidden. */
export function sanitiseLayout(input: unknown): PortalLayout {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {}
  const seen = new Set<PortalSection>()
  const order: PortalSection[] = []
  for (const item of Array.isArray(raw.order) ? raw.order : []) {
    if (isSection(item) && !seen.has(item)) {
      seen.add(item)
      order.push(item)
    }
  }
  for (const section of PORTAL_SECTIONS) if (!seen.has(section)) order.push(section)
  const hidden = [...new Set((Array.isArray(raw.hidden) ? raw.hidden : []).filter(isSection))].filter((s) => !ALWAYS_SHOWN.includes(s))
  return { order, hidden }
}

export const brandingOf = (metadata: Record<string, unknown>): Branding => sanitiseBranding(metadata[BRANDING_KEY])
export const layoutOf = (metadata: Record<string, unknown>): PortalLayout => sanitiseLayout(metadata[LAYOUT_KEY])

export const hasBranding = (b: Branding): boolean => BRANDING_COLOUR_FIELDS.some((f) => b[f] !== '') || b.headingFont !== 'default' || b.bodyFont !== 'default'

/** The sections to render, in the company's order, minus the hidden ones. */
export const visibleSections = (layout: PortalLayout): PortalSection[] => layout.order.filter((s) => !layout.hidden.includes(s))

/**
 * Metadata JSON text with branding and layout replaced and every other key kept.
 * Returns null when the result would be larger than the metadata limit, and '' when nothing is left.
 */
export function withBrandingAndLayout(metadataText: string | null | undefined, branding: Branding, layout: PortalLayout): string | null {
  let base: Record<string, unknown> = {}
  try {
    const parsed = metadataText ? (JSON.parse(metadataText) as unknown) : null
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) base = { ...(parsed as Record<string, unknown>) }
  } catch {
    base = {}
  }
  if (hasBranding(branding)) base[BRANDING_KEY] = branding
  else delete base[BRANDING_KEY]
  const defaultOrder = layout.order.every((s, i) => s === PORTAL_SECTIONS[i])
  if (defaultOrder && layout.hidden.length === 0) delete base[LAYOUT_KEY]
  else base[LAYOUT_KEY] = layout
  if (Object.keys(base).length === 0) return ''
  const text = JSON.stringify(base)
  return text.length <= MAX_METADATA_BYTES ? text : null
}

/** What a free-form metadata edit may change: everything except the branding and layout keys, which are carried over from the stored copy. */
export function keepBrandingKeys(incoming: string | null, stored: string | null | undefined): string | null {
  let next: Record<string, unknown> = {}
  let old: Record<string, unknown> = {}
  try {
    const parsed = incoming ? (JSON.parse(incoming) as unknown) : null
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) next = { ...(parsed as Record<string, unknown>) }
  } catch {
    next = {}
  }
  try {
    const parsed = stored ? (JSON.parse(stored) as unknown) : null
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) old = parsed as Record<string, unknown>
  } catch {
    old = {}
  }
  delete next[BRANDING_KEY]
  delete next[LAYOUT_KEY]
  if (BRANDING_KEY in old) next[BRANDING_KEY] = old[BRANDING_KEY]
  if (LAYOUT_KEY in old) next[LAYOUT_KEY] = old[LAYOUT_KEY]
  if (Object.keys(next).length === 0) return null
  return JSON.stringify(next)
}

/** The metadata with the branding and layout keys removed, for showing the free-form part to people. */
export function plainMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const { [BRANDING_KEY]: _b, [LAYOUT_KEY]: _l, ...rest } = metadata
  return rest
}

/**
 * The stylesheet for one company's portal pages, scoped to `.org-portal`. Empty when the
 * company set nothing. Only validated colours and fixed font stacks are written.
 */
export function brandingCss(branding: Branding): string {
  const vars: string[] = []
  if (branding.primary) vars.push(`--org-primary:${branding.primary}`)
  if (branding.accent) vars.push(`--org-accent:${branding.accent}`)
  if (branding.background) vars.push(`--org-bg:${branding.background}`)
  if (branding.text) vars.push(`--org-text:${branding.text}`)
  const head = BRANDING_FONTS[branding.headingFont]
  const body = BRANDING_FONTS[branding.bodyFont]
  if (head) vars.push(`--org-heading-font:${head}`)
  if (body) vars.push(`--org-body-font:${body}`)
  if (vars.length === 0) return ''
  const rules = [`.org-portal{${vars.join(';')}}`]
  if (branding.background) rules.push('.org-portal{background:var(--org-bg);padding:1rem;border-radius:12px}')
  if (branding.text) rules.push('.org-portal{color:var(--org-text)}')
  if (body) rules.push('.org-portal{font-family:var(--org-body-font)}')
  if (head) rules.push('.org-portal h1,.org-portal h2,.org-portal h3{font-family:var(--org-heading-font)}')
  if (branding.primary) rules.push('.org-portal .btn:not(.btn--ghost),.org-portal button[type=submit]:not(.btn--ghost){background:var(--org-primary);border-color:var(--org-primary)}', '.org-portal .org-badge{background:var(--org-primary);color:#fff}')
  if (branding.accent) rules.push('.org-portal a{color:var(--org-accent)}', '.org-portal .org-section h2{border-bottom:2px solid var(--org-accent);padding-bottom:.25rem}')
  return rules.join('\n')
}

type FormLike = { get: (name: string) => unknown }

/** Reads the branding form: colour and font fields, and for each section a position number and a "show" box. */
export function brandingInputFromForm(form: FormLike): { branding: Record<string, unknown>; layout: { order: string[]; hidden: string[] } } {
  const str = (name: string): string => {
    const v = form.get(name)
    return typeof v === 'string' ? v : ''
  }
  const branding: Record<string, unknown> = { headingFont: str('headingFont'), bodyFont: str('bodyFont') }
  for (const field of BRANDING_COLOUR_FIELDS) branding[field] = str(field)
  const ranked = PORTAL_SECTIONS.map((section, index) => {
    const n = Number(str(`pos_${section}`))
    return { section, rank: Number.isFinite(n) && str(`pos_${section}`) !== '' ? n : index + 1, index }
  }).sort((a, b) => a.rank - b.rank || a.index - b.index)
  return {
    branding,
    layout: { order: ranked.map((r) => r.section), hidden: PORTAL_SECTIONS.filter((section) => str(`show_${section}`) !== 'yes') },
  }
}
