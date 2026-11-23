/**
 * Clone a theme from a website (Task 14, 33e). Reads a page's HTML and CSS text and proposes colours, fonts and a corner
 * radius. No outside service: the numbers are counted from the CSS, so the same page always gives the same proposal.
 * The owner confirms each proposed value in the editor before anything changes. Pure: the fetch is in the API route.
 */
import { sanitizeColourValue } from './sanitize'
import type { ThemeStyles } from './types'

export type ClonedColour = { id: string; label: string; value: string; uses: number }
export type ClonedTheme = {
  colours: ClonedColour[]
  headingFont: string
  bodyFont: string
  radius: number | null
  note: string
}

const HEX = /#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi

function expand(hex: string): string {
  const h = hex.toLowerCase()
  return h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h
}

function rgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}

const luma = (hex: string): number => {
  const [r, g, b] = rgb(hex)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

const saturation = (hex: string): number => {
  const [r, g, b] = rgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max === 0 ? 0 : (max - min) / max
}

/** Counts hex colours in CSS and HTML text, most used first. Pure white and black are counted like any other. */
export function countColours(text: string): Array<{ hex: string; uses: number }> {
  const counts = new Map<string, number>()
  for (const match of text.matchAll(HEX)) {
    const hex = expand(match[0])
    counts.set(hex, (counts.get(hex) ?? 0) + 1)
  }
  return [...counts.entries()].map(([hex, uses]) => ({ hex, uses })).sort((a, b) => b.uses - a.uses || (a.hex < b.hex ? -1 : 1))
}

function firstFont(value: string): string {
  const first = value.split(',')[0]?.trim().replace(/^["']|["']$/g, '') ?? ''
  return /^[A-Za-z0-9 _-]{2,60}$/.test(first) && !/^(inherit|initial|unset|serif|sans-serif|monospace|system-ui|-apple-system)$/i.test(first) ? first : ''
}

/** Proposes a theme from page text. `text` is the page's HTML plus its stylesheets, already size limited. */
export function extractThemeFromText(text: string): ClonedTheme {
  const counted = countColours(text)
  const total = counted.reduce((sum, c) => sum + c.uses, 0)
  const meta = /<meta[^>]+name=["']theme-color["'][^>]+content=["'](#[0-9a-f]{3,6})["']/i.exec(text)?.[1]
  const bodyBg = /body\s*\{[^}]*background(?:-color)?\s*:\s*(#[0-9a-f]{3,6})/i.exec(text)?.[1]
  const bodyColour = /body\s*\{[^}]*[^-]color\s*:\s*(#[0-9a-f]{3,6})/i.exec(text)?.[1]

  const light = counted.filter((c) => luma(c.hex) > 0.9)
  const darkText = counted.filter((c) => luma(c.hex) < 0.3 && saturation(c.hex) < 0.5)
  const vivid = counted.filter((c) => saturation(c.hex) > 0.35 && luma(c.hex) > 0.12 && luma(c.hex) < 0.85)

  const background = bodyBg ? expand(bodyBg) : (light[0]?.hex ?? '#ffffff')
  const ink = bodyColour ? expand(bodyColour) : (darkText[0]?.hex ?? '#111827')
  const accent = vivid[0]?.hex ?? (meta ? expand(meta) : '')
  const primary = meta ? expand(meta) : (vivid[1]?.hex ?? ink)
  const surface = counted.find((c) => c.hex !== background && luma(c.hex) > 0.85 && luma(c.hex) <= 0.99)?.hex ?? ''
  const border = counted.find((c) => luma(c.hex) > 0.7 && luma(c.hex) < 0.93 && saturation(c.hex) < 0.2 && c.hex !== surface && c.hex !== background)?.hex ?? ''

  const uses = (hex: string) => counted.find((c) => c.hex === hex)?.uses ?? 0
  const colours: ClonedColour[] = [
    { id: 'background', label: 'Background', value: background, uses: uses(background) },
    { id: 'text', label: 'Text', value: ink, uses: uses(ink) },
    { id: 'primary', label: 'Primary', value: primary, uses: uses(primary) },
    ...(accent ? [{ id: 'accent', label: 'Accent', value: accent, uses: uses(accent) }] : []),
    ...(surface ? [{ id: 'surface', label: 'Surface', value: surface, uses: uses(surface) }] : []),
    ...(border ? [{ id: 'border', label: 'Border', value: border, uses: uses(border) }] : []),
  ].filter((c, i, all) => c.value && all.findIndex((o) => o.id === c.id) === i)

  const headingFont = firstFont(/\bh1\s*[,{][^}]*font-family\s*:\s*([^;}]+)/i.exec(text)?.[1] ?? '')
  const bodyFont = firstFont(/\bbody\s*\{[^}]*font-family\s*:\s*([^;}]+)/i.exec(text)?.[1] ?? '') || firstFont(/font-family\s*:\s*([^;}]+)/i.exec(text)?.[1] ?? '')

  const radii = [...text.matchAll(/border-radius\s*:\s*(\d{1,2})px/gi)].map((m) => Number(m[1])).filter((n) => n > 0)
  const radius = radii.length ? [...radii].sort((a, b) => a - b)[Math.floor(radii.length / 2)] : null

  const note = total === 0 ? 'No colours were found on that page. It may draw its styles with a script.' : `Read ${total} colour values from the page.`
  return { colours, headingFont, bodyFont, radius, note }
}

/** Applies the chosen proposed colours (by id) and radius to a theme. Colours go through the theme's colour check. */
export function applyClonedTheme(styles: ThemeStyles, cloned: ClonedTheme, pick: { colours: string[]; radius: boolean }): ThemeStyles {
  const next: ThemeStyles = structuredClone(styles)
  for (const proposal of cloned.colours) {
    if (!pick.colours.includes(proposal.id)) continue
    const target = next.colours.find((c) => c.id === proposal.id)
    const value = sanitizeColourValue(proposal.value)
    if (target && value) {
      target.value = value
      target.darkValue = ''
    }
  }
  if (pick.radius && cloned.radius !== null) {
    next.buttons = next.buttons.map((button) => ({ ...button, radius: cloned.radius as number }))
    next.globals.forms.fieldRadius = cloned.radius
  }
  return next
}
