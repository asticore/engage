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

  it('adds Greek to Inter and Vietnamese to the faces that ship it, each pinned with its unicode-range', () => {
    const inter = buildBuiltInFontCss(['inter'])
    expect(inter).toContain('https://cdn.jsdelivr.net/npm/@fontsource/inter@5.3.0/files/inter-greek-400-normal.woff2')
    expect(inter).toContain('unicode-range: U+0370-0377')
    expect(inter).toContain('https://cdn.jsdelivr.net/npm/@fontsource/inter@5.3.0/files/inter-vietnamese-600-normal.woff2')
    expect(inter).toContain('unicode-range: U+0102-0103')

    const cormorant = buildBuiltInFontCss(['cormorant'])
    expect(cormorant).toContain('https://cdn.jsdelivr.net/npm/@fontsource/cormorant-garamond@5.3.0/files/cormorant-garamond-vietnamese-700-normal.woff2')
    expect(cormorant).not.toContain('greek')
  })

  it('does not ask for a Greek or Vietnamese file a face does not ship', () => {
    expect(buildBuiltInFontCss(['cinzel'])).not.toMatch(/greek|vietnamese/)
    expect(buildBuiltInFontCss(['jost'])).not.toMatch(/greek|vietnamese/)
    expect(buildBuiltInFontCss(['montserrat'])).not.toContain('greek')
  })

  it('gives every rule a unicode-range and a swap display, so only the needed subset is fetched', () => {
    const rules = buildBuiltInFontCss(['inter']).split('\n')
    expect(rules.length).toBe(5 * 3)
    for (const rule of rules) {
      expect(rule).toContain('unicode-range:')
      expect(rule).toContain('font-display: swap')
    }
  })
})
