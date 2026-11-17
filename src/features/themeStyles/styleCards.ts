/**
 * Style picks: the owner chooses website styles they like, we explain why each suits, and a theme is generated from the
 * picks. No outside service and no randomness: the same picks and the same seed always give the same theme, and a different
 * seed (the site name, or Shuffle) shifts the colours so two sites with the same picks still differ. One style system only:
 * the result is an ordinary theme preset (colours, text, buttons, layout) that the owner reviews and saves.
 */
import { UI_STRING_SOURCE, type UiStringKey } from '@/features/uiStrings/keys'
import { effectById } from '@/features/effects/catalog'
import { base } from './presets'
import type { ButtonStyle, ThemePresetData } from './types'

export type StyleCard = {
  id: string
  name: string
  /** One line describing the look. */
  look: string
  /** Why this style suits, shown to the owner. */
  suits: string
  hue: number
  saturation: number
  /** 0 to 100: how light the page is. Below 35 the theme is dark. */
  lightness: number
  /** Accent hue offset from the base hue, degrees. */
  accentShift: number
  radius: number
  headings: 'heading' | 'body'
  buttonCase: 'none' | 'uppercase'
  /** The kind of heading face that fits (matched against the category of the fonts installed in Site fonts). */
  headingFont: 'serif' | 'sans-serif' | 'display'
  /** Effects (ids from the Effects picker) that suit this look; one is suggested per theme. */
  effects: string[]
}

/** The font families a theme can choose from: the ones installed in Site fonts. */
export type FontChoice = { id: string; family: string; category?: string }

export const STYLE_CARDS: StyleCard[] = [
  { id: 'minimal', name: 'Minimal', look: 'Lots of white space, thin lines, one quiet accent.', suits: 'Suits portfolios, consultancies and anything where the content should do the talking.', hue: 220, saturation: 12, lightness: 98, accentShift: 0, radius: 2, headings: 'body', buttonCase: 'none', headingFont: 'sans-serif', effects: ['counter'] },
  { id: 'editorial', name: 'Editorial', look: 'Serif style headings, calm paper tones, strong reading rhythm.', suits: 'Suits blogs, magazines and long form content because it keeps reading comfortable.', hue: 35, saturation: 28, lightness: 96, accentShift: 180, radius: 0, headings: 'heading', buttonCase: 'none', headingFont: 'serif', effects: ['carousel'] },
  { id: 'bold', name: 'Bold', look: 'Saturated colour, big shapes, loud buttons.', suits: 'Suits events, launches and shops that want to be noticed in a scroll.', hue: 8, saturation: 82, lightness: 97, accentShift: 40, radius: 10, headings: 'body', buttonCase: 'uppercase', headingFont: 'display', effects: ['countdown', 'counter'] },
  { id: 'playful', name: 'Playful', look: 'Rounded corners, bright friendly colours.', suits: 'Suits kids, food, hobby and community sites where warmth builds trust.', hue: 285, saturation: 65, lightness: 97, accentShift: 90, radius: 24, headings: 'heading', buttonCase: 'none', headingFont: 'display', effects: ['toast', 'carousel'] },
  { id: 'luxe', name: 'Luxe', look: 'Deep tones, gold touches, restrained type.', suits: 'Suits jewellery, hospitality and premium products where price signals quality.', hue: 40, saturation: 45, lightness: 12, accentShift: 0, radius: 0, headings: 'heading', buttonCase: 'uppercase', headingFont: 'serif', effects: ['carousel'] },
  { id: 'corporate', name: 'Corporate', look: 'Blue and grey, tidy grids, clear buttons.', suits: 'Suits professional services, B2B and finance where trust and clarity come first.', hue: 215, saturation: 55, lightness: 98, accentShift: 20, radius: 6, headings: 'body', buttonCase: 'none', headingFont: 'sans-serif', effects: ['counter', 'chart-bar'] },
  { id: 'nature', name: 'Natural', look: 'Earth greens and sand, soft edges.', suits: 'Suits wellness, outdoors, farms and sustainable brands.', hue: 135, saturation: 30, lightness: 96, accentShift: 200, radius: 14, headings: 'heading', buttonCase: 'none', headingFont: 'serif', effects: ['carousel'] },
  { id: 'tech', name: 'Tech dark', look: 'Dark surface, glowing accent, sharp type.', suits: 'Suits software, gaming and data products where a dark interface feels at home.', hue: 255, saturation: 70, lightness: 10, accentShift: 60, radius: 8, headings: 'body', buttonCase: 'none', headingFont: 'sans-serif', effects: ['chart-radar', 'shimmer'] },
  { id: 'retro', name: 'Retro', look: 'Warm mustard and teal, chunky buttons.', suits: 'Suits cafes, craft makers and music, where personality beats polish.', hue: 45, saturation: 70, lightness: 95, accentShift: 160, radius: 4, headings: 'heading', buttonCase: 'uppercase', headingFont: 'display', effects: ['popup', 'toast'] },
  { id: 'soft', name: 'Soft pastel', look: 'Gentle pastels, generous padding, round shapes.', suits: 'Suits beauty, wedding and lifestyle sites that want a calm, welcoming feel.', hue: 340, saturation: 50, lightness: 97, accentShift: 120, radius: 18, headings: 'heading', buttonCase: 'none', headingFont: 'display', effects: ['toast'] },
]

export const isStyleCard = (id: unknown): id is string => typeof id === 'string' && STYLE_CARDS.some((c) => c.id === id)

/** A small stable hash of text to a number, used to vary a theme by site. */
export function seedNumber(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

export function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360
  const ss = clamp(s, 0, 100) / 100
  const ll = clamp(l, 0, 100) / 100
  const k = (n: number) => (n + hh / 30) % 12
  const a = ss * Math.min(ll, 1 - ll)
  const f = (n: number) => Math.round(255 * (ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))))
  return `#${[f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** Circular mean of hues, so 350 and 10 average to 0, not 180. */
function meanHue(hues: number[]): number {
  const x = hues.reduce((n, h) => n + Math.cos((h * Math.PI) / 180), 0)
  const y = hues.reduce((n, h) => n + Math.sin((h * Math.PI) / 180), 0)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/** One line of the explanation: a text key (themeStyle.r.*) and its values. A value is plain text, a text key, or a list of keys. */
export type ReasonItem = { key: string; vars?: Record<string, string | { key: string } | { keys: string[] }> }

/** Fills the explanation lines. `translate` turns a text key into its text (English from the key table, or the admin's language). */
export function formatReasons(items: ReasonItem[], translate: (key: string) => string): string[] {
  const value = (v: string | { key: string } | { keys: string[] }): string => (typeof v === 'string' ? v : 'key' in v ? translate(v.key) : v.keys.map(translate).join(', '))
  return items.map((item) => translate(item.key).replace(/\{(\w+)\}/g, (whole, name: string) => (item.vars && name in item.vars ? value(item.vars[name]) : whole)))
}

export type GeneratedTheme = { data: ThemePresetData; reasons: string[]; reasonItems: ReasonItem[]; dark: boolean; headingFont: FontChoice | null; bodyFont: FontChoice | null; effect: { id: string; label: string } | null }

/** Builds a theme from the picked styles. Needs at least one pick; unknown ids are ignored. */
export function generateTheme(picks: string[], seed: string, fonts: FontChoice[] = []): GeneratedTheme | null {
  const cards = STYLE_CARDS.filter((c) => picks.includes(c.id))
  if (cards.length === 0) return null
  const n = seedNumber(`${seed}|${cards.map((c) => c.id).sort().join(',')}`)
  const wobble = ((n % 25) - 12) // -12 to 12 degrees, so the same picks differ site to site
  const hue = (meanHue(cards.map((c) => c.hue)) + wobble + 360) % 360
  const avg = (pick: (c: StyleCard) => number) => cards.reduce((t, c) => t + pick(c), 0) / cards.length
  const sat = clamp(avg((c) => c.saturation) + ((n >> 5) % 9) - 4, 5, 90)
  const light = avg((c) => c.lightness)
  const dark = light < 35
  const accentHue = hue + avg((c) => c.accentShift) + (((n >> 9) % 21) - 10)
  const radius = Math.round(avg((c) => c.radius))
  const heading: 'heading' | 'body' = cards.filter((c) => c.headings === 'heading').length * 2 >= cards.length ? 'heading' : 'body'
  const upper = cards.filter((c) => c.buttonCase === 'uppercase').length * 2 > cards.length

  // Font pairing: only fonts installed in Site fonts can be named by a theme, so choose among those.
  const wantKind = (['serif', 'sans-serif', 'display'] as const)
    .map((k) => ({ k, n: cards.filter((c) => c.headingFont === k).length }))
    .sort((a, b) => b.n - a.n)[0].k
  const kindOf = (f: FontChoice) => (f.category === 'serif' ? 'serif' : f.category === 'display' || f.category === 'handwriting' ? 'display' : 'sans-serif')
  const headings = fonts.filter((f) => kindOf(f) === wantKind)
  const headingFont = headings.length ? headings[(n >> 13) % headings.length] : null
  const bodies = fonts.filter((f) => kindOf(f) === 'sans-serif' && f.id !== headingFont?.id)
  const bodyFont = bodies.length ? bodies[(n >> 17) % bodies.length] : null
  const effectIds = [...new Set(cards.flatMap((c) => c.effects))].filter((id) => effectById(id))
  const effectDef = effectIds.length ? effectById(effectIds[(n >> 21) % effectIds.length]) : undefined

  const data = base()
  const set = (id: string, value: string, darkValue?: string) => {
    const colour = data.colours.find((c) => c.id === id)
    if (!colour) return
    colour.value = value
    if (darkValue !== undefined) colour.darkValue = darkValue
  }
  if (dark) {
    set('background', hslToHex(hue, sat * 0.5, 9), '')
    set('surface', hslToHex(hue, sat * 0.45, 14), '')
    set('border', hslToHex(hue, sat * 0.4, 24), '')
    set('text', hslToHex(hue, 15, 93), '')
    set('primary', hslToHex(hue, 15, 96), '')
    set('secondary', hslToHex(hue, 12, 70), '')
    set('accent', hslToHex(accentHue, clamp(sat + 10, 40, 90), 66), '')
  } else {
    set('background', hslToHex(hue, Math.min(sat, 30) * 0.5, clamp(light, 94, 99)), hslToHex(hue, sat * 0.4, 9))
    set('surface', '#ffffff', hslToHex(hue, sat * 0.4, 14))
    set('border', hslToHex(hue, Math.min(sat, 30) * 0.6, 88), hslToHex(hue, sat * 0.35, 24))
    set('text', hslToHex(hue, Math.min(sat, 35), 12), hslToHex(hue, 15, 93))
    set('primary', hslToHex(hue, clamp(sat, 20, 70), 22), hslToHex(hue, 15, 96))
    set('secondary', hslToHex(hue, Math.min(sat, 25), 40), hslToHex(hue, 12, 70))
    set('accent', hslToHex(accentHue, clamp(sat + 15, 45, 85), 40), hslToHex(accentHue, clamp(sat + 15, 45, 85), 62))
  }
  for (const t of data.typography) if (/^h[1-6]$/.test(t.id)) t.fontFamily = headingFont ? headingFont.id : heading
  if (bodyFont) for (const t of data.typography) if (!/^h[1-6]$/.test(t.id) && t.fontFamily === 'body') t.fontFamily = bodyFont.id
  data.buttons = data.buttons.map((b: ButtonStyle) => ({ ...b, radius, transform: upper ? 'uppercase' : 'none', letterSpacing: upper ? 1 : b.letterSpacing }))
  data.globals.forms.fieldRadius = Math.min(radius, 16)
  data.globals.images.radius = Math.min(radius, 24)

  const kindKey = wantKind === 'sans-serif' ? 'sans' : wantKind
  const effectText = effectDef ? { label: effectDef.label, help: effectDef.help } : null
  const reasonItems: ReasonItem[] = [
    ...cards.map((c): ReasonItem => ({ key: 'themeStyle.r.card', vars: { name: { key: `themeStyle.${c.id}.name` }, suits: { key: `themeStyle.${c.id}.suits` } } })),
    cards.length > 1
      ? { key: 'themeStyle.r.blend', vars: { names: { keys: cards.map((c) => `themeStyle.${c.id}.name`) } } }
      : { key: 'themeStyle.r.follow', vars: { name: { key: `themeStyle.${cards[0].id}.name` } } },
    { key: dark ? 'themeStyle.r.dark' : 'themeStyle.r.light' },
    { key: 'themeStyle.r.corners', vars: { corners: { key: `themeStyle.corner.${radius === 0 ? 'square' : radius < 8 ? 'barely' : radius < 16 ? 'soft' : 'round'}` }, font: { key: `themeStyle.font.${heading}` } } },
    headingFont
      ? { key: bodyFont ? 'themeStyle.r.fontsBoth' : 'themeStyle.r.fontsHeading', vars: { heading: headingFont.family, body: bodyFont?.family ?? '', kind: { key: `themeStyle.kind.${kindKey}` } } }
      : { key: 'themeStyle.r.fontsNone', vars: { kind: { key: `themeStyle.kindNoun.${kindKey}` } } },
    effectText ? { key: 'themeStyle.r.effect', vars: { label: effectText.label, help: effectText.help } } : { key: 'themeStyle.r.effectNone' },
    { key: 'themeStyle.r.variation' },
  ]
  const reasons = formatReasons(reasonItems, (key) => UI_STRING_SOURCE[key as UiStringKey] ?? key)
  return { data, reasons, reasonItems, dark, headingFont, bodyFont, effect: effectDef ? { id: effectDef.id, label: effectDef.label } : null }
}
