import { describe, expect, it } from 'vitest'

import { buildBuiltInFontCss, builtInFaceKeys } from '@/features/fonts/builtIn'

describe('built-in theme fonts', () => {
  it('emits faces only for the keys the theme picks', () => {
    const css = buildBuiltInFontCss(['jost', null])
    expect(css).toContain('font-family: "Jost"')
    expect(css).not.toContain('Cormorant')
    expect(css).not.toContain('Montserrat')
    expect(css).not.toContain('Inter')
  })

  it('ignores keys that are not built-in faces (installed fonts, junk, prototype names)', () => {
    expect(builtInFaceKeys(['my-custom-font', 'constructor', '', undefined, 'cinzel', 'cinzel'])).toEqual(['cinzel'])
    expect(buildBuiltInFontCss(['constructor'])).toBe('')
  })

  it('pins the jsDelivr npm version and never uses an unpinned @latest URL', () => {
    const css = buildBuiltInFontCss(['cormorant'])
    expect(css).toContain('https://cdn.jsdelivr.net/npm/@fontsource/cormorant-garamond@5.3.0/files/cormorant-garamond-latin-400-normal.woff2')
    expect(css).not.toContain('@latest')
  })

  it('ships only the subsets each face has (Cinzel has no Cyrillic file)', () => {
    const css = buildBuiltInFontCss(['cinzel'])
    expect(css).not.toContain('cyrillic')
    expect(css).toContain('cinzel-latin-ext-600-normal.woff2')
  })

  it('gives every rule a unicode-range and a swap display, so only the needed subset is fetched', () => {
    const rules = buildBuiltInFontCss(['inter']).split('\n')
    expect(rules.length).toBe(3 * 3)
    for (const rule of rules) {
      expect(rule).toContain('unicode-range:')
      expect(rule).toContain('font-display: swap')
    }
  })
})
