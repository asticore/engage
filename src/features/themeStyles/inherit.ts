/**
 * Master theme (Task 14, 33e). The primary domain's theme is the master. Every other registered domain inherits all of
 * it and overrides only the tokens chosen here: colour values (light and dark), the heading and body font, and two
 * corner radii. Pure: sanitising, applying and describing overrides. No database access.
 */
import { sanitizeColourValue } from './sanitize'
import type { ThemeStyles } from './types'

export type ColourOverride = { value?: string; darkValue?: string }

export type ThemeOverrides = {
  /** Colour id (a colour the master has) to the changed values. Missing keys inherit. */
  colours: Record<string, ColourOverride>
  /** A font family value as the typography presets store it (`heading`, `body` or an installed font id). Empty inherits. */
  headingFont: string
  bodyFont: string
  /** Button corner radius in px, or null to inherit. */
  buttonRadius: number | null
  /** Form field corner radius in px, or null to inherit. */
  fieldRadius: number | null
}

export const NO_THEME_OVERRIDES: ThemeOverrides = { colours: {}, headingFont: '', bodyFont: '', buttonRadius: null, fieldRadius: null }

const ID_RE = /^[a-z0-9-]{1,32}$/
const FONT_RE = /^[a-zA-Z0-9_-]{1,64}$/
const MAX_COLOURS = 40

const radius = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
  return Number.isFinite(n) && n >= 0 && n <= 64 ? Math.round(n) : null
}

/** Cleans untrusted input into overrides. Unknown shapes are dropped, colours go through the theme's own colour check. */
export function sanitizeThemeOverrides(input: unknown): ThemeOverrides {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {}
  const colours: Record<string, ColourOverride> = {}
  const rawColours = raw.colours && typeof raw.colours === 'object' && !Array.isArray(raw.colours) ? (raw.colours as Record<string, unknown>) : {}
  for (const [id, entry] of Object.entries(rawColours).slice(0, MAX_COLOURS)) {
    if (!ID_RE.test(id) || !entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>
    const clean: ColourOverride = {}
    if (typeof e.value === 'string' && e.value.trim()) {
      const v = sanitizeColourValue(e.value)
      if (v) clean.value = v
    }
    if (typeof e.darkValue === 'string' && e.darkValue.trim()) {
      const v = sanitizeColourValue(e.darkValue)
      if (v) clean.darkValue = v
    }
    if (clean.value !== undefined || clean.darkValue !== undefined) colours[id] = clean
  }
  const font = (value: unknown): string => (typeof value === 'string' && FONT_RE.test(value.trim()) ? value.trim() : '')
  return { colours, headingFont: font(raw.headingFont), bodyFont: font(raw.bodyFont), buttonRadius: radius(raw.buttonRadius), fieldRadius: radius(raw.fieldRadius) }
}

/** True when the overrides change nothing. */
export function isEmptyOverrides(overrides: ThemeOverrides): boolean {
  return Object.keys(overrides.colours).length === 0 && !overrides.headingFont && !overrides.bodyFont && overrides.buttonRadius === null && overrides.fieldRadius === null
}

/** The master theme with the domain's overrides on top. The master is not changed. A colour id the master lacks is ignored. */
export function applyThemeOverrides(master: ThemeStyles, overrides: ThemeOverrides): ThemeStyles {
  if (isEmptyOverrides(overrides)) return master
  const next: ThemeStyles = structuredClone(master)
  for (const colour of next.colours) {
    const change = overrides.colours[colour.id]
    if (!change) continue
    if (change.value !== undefined) colour.value = change.value
    if (change.darkValue !== undefined) colour.darkValue = change.darkValue
  }
  for (const style of next.typography) {
    if (overrides.headingFont && /^h[1-6]$/.test(style.id)) style.fontFamily = overrides.headingFont
    if (overrides.bodyFont && style.id === 'body') style.fontFamily = overrides.bodyFont
  }
  if (overrides.buttonRadius !== null) next.buttons = next.buttons.map((button) => ({ ...button, radius: overrides.buttonRadius as number }))
  if (overrides.fieldRadius !== null) next.globals.forms.fieldRadius = overrides.fieldRadius
  return next
}

export type OverrideRow = { id: string; name: string; inherited: string; inheritedDark: string; value: string; darkValue: string; overridden: boolean }

/** One row per master colour for the domain editor: what it inherits, what it overrides, and whether it is overridden. */
export function describeColourOverrides(master: ThemeStyles, overrides: ThemeOverrides): OverrideRow[] {
  return master.colours.map((colour) => {
    const change = overrides.colours[colour.id]
    return {
      id: colour.id,
      name: colour.name,
      inherited: colour.value,
      inheritedDark: colour.darkValue,
      value: change?.value ?? colour.value,
      darkValue: change?.darkValue ?? colour.darkValue,
      overridden: Boolean(change && (change.value !== undefined || change.darkValue !== undefined)),
    }
  })
}
