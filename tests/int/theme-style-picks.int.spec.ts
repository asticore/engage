import { describe, expect, it } from 'vitest'

import { formatReasons, generateTheme, hslToHex, seedNumber, STYLE_CARDS } from '@/features/themeStyles/styleCards'
import { effectById } from '@/features/effects/catalog'
import { applyPreset } from '@/features/themeStyles/presets'
import { sanitizeThemeStyles } from '@/features/themeStyles/sanitize'
import { DEFAULT_THEME_STYLES } from '@/features/themeStyles/types'

const lum = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string): number => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)

describe('theme from style picks', () => {
  it('keeps body text readable on the background for every style and seed', () => {
    for (const card of STYLE_CARDS) {
      for (const seed of ['a', 'Acme', 'zed', 'shop 9']) {
        const c = generateTheme([card.id], seed)!.data.colours
        const get = (id: string) => c.find((x) => x.id === id)!.value
        expect(contrast(get('text'), get('background')), `${card.id}/${seed}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
  it('needs a pick, and ignores unknown ones', () => {
    expect(generateTheme([], 'a')).toBeNull()
    expect(generateTheme(['nope'], 'a')).toBeNull()
  })
  it('is the same for the same picks and seed, and differs by seed', () => {
    const a = generateTheme(['minimal', 'nature'], 'Acme')!
    expect(generateTheme(['nature', 'minimal'], 'Acme')!.data.colours).toEqual(a.data.colours)
    const other = generateTheme(['minimal', 'nature'], 'Zed Co')!
    expect(other.data.colours.find((c) => c.id === 'accent')!.value).not.toBe(a.data.colours.find((c) => c.id === 'accent')!.value)
  })
  it('explains every pick and gives dark themes a dark background', () => {
    const t = generateTheme(['tech', 'luxe'], 'x')!
    expect(t.dark).toBe(true)
    expect(t.reasons.some((r) => r.startsWith('Tech dark:'))).toBe(true)
    expect(t.reasons.some((r) => r.startsWith('Luxe:'))).toBe(true)
    expect(t.data.colours.find((c) => c.id === 'background')!.value).toMatch(/^#[0-9a-f]{6}$/)
    expect(generateTheme(['minimal'], 'x')!.dark).toBe(false)
  })
  it('every card makes a theme that passes the sanitiser unchanged', () => {
    for (const card of STYLE_CARDS) {
      const theme = generateTheme([card.id], 'site')!
      const applied = applyPreset(DEFAULT_THEME_STYLES, theme.data)
      expect(sanitizeThemeStyles(applied)).toEqual(applied)
    }
  })
  it('converts colours and hashes stably', () => {
    expect(hslToHex(0, 100, 50)).toBe('#ff0000')
    expect(hslToHex(120, 100, 50)).toBe('#00ff00')
    expect(seedNumber('a')).toBe(seedNumber('a'))
  })
  it('picks a heading and body font from the installed Site fonts, and says why', () => {
    const fonts = [
      { id: 'lora', family: 'Lora', category: 'serif' },
      { id: 'work-sans', family: 'Work Sans', category: 'sans-serif' },
    ]
    const t = generateTheme(['editorial', 'luxe'], 'x', fonts)!
    expect(t.headingFont?.id).toBe('lora')
    expect(t.bodyFont?.id).toBe('work-sans')
    expect(t.data.typography.find((x) => x.id === 'h1')!.fontFamily).toBe('lora')
    expect(t.reasons.some((r) => r.startsWith('Fonts: Lora for headings and Work Sans for text'))).toBe(true)
    const applied = applyPreset(DEFAULT_THEME_STYLES, t.data)
    expect(sanitizeThemeStyles(applied)).toEqual(applied)
  })
  it('keeps the theme fonts and says so when no matching font is installed', () => {
    const t = generateTheme(['editorial'], 'x', [{ id: 'work-sans', family: 'Work Sans', category: 'sans-serif' }])!
    expect(t.headingFont).toBeNull()
    expect(t.reasons.some((r) => r.startsWith('Fonts: no serif font is installed'))).toBe(true)
    expect(generateTheme(['editorial'], 'x')!.headingFont).toBeNull()
  })
  it('suggests an effect from the Effects picker for every style', () => {
    for (const card of STYLE_CARDS) {
      const t = generateTheme([card.id], 'site')!
      expect(t.effect, card.id).not.toBeNull()
      expect(effectById(t.effect!.id)).toBeDefined()
      expect(t.reasons.some((r) => r.startsWith('Suggested effect:'))).toBe(true)
    }
  })
  it('has text for every explanation line, in every language, with its placeholders kept', async () => {
    const { UI_STRING_SOURCE } = await import('@/features/uiStrings/keys')
    const t = generateTheme(['editorial', 'luxe', 'tech'], 'x', [{ id: 'lora', family: 'Lora', category: 'serif' }])!
    const keys = new Set<string>()
    for (const item of t.reasonItems) {
      keys.add(item.key)
      for (const v of Object.values(item.vars ?? {})) if (typeof v === 'object') for (const k of 'key' in v ? [v.key] : v.keys) keys.add(k)
    }
    for (const k of keys) expect(k in UI_STRING_SOURCE, k).toBe(true)
    expect(formatReasons(t.reasonItems, (k) => `<${k}>`).some((r) => r.includes('{'))).toBe(false)
    for (const locale of ['de', 'es', 'fr', 'it', 'nl', 'pt', 'ru', 'ja', 'ko', 'zh-Hans', 'hi', 'ar']) {
      const dict = (await import(`@/features/uiStrings/dictionaries/${locale}`)).default as Record<string, string>
      for (const k of Object.keys(UI_STRING_SOURCE).filter((x) => x.startsWith('themeStyle.r.'))) {
        for (const ph of UI_STRING_SOURCE[k as keyof typeof UI_STRING_SOURCE].match(/\{\w+\}/g) ?? []) expect(dict[k], `${locale} ${k}`).toContain(ph)
      }
    }
  })
})
