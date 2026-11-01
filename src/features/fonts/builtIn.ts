/**
 * The theme's built-in heading and body faces, loaded only when the theme picks them.
 *
 * Before this, the frontend layout imported every built-in family (six
 * Fontsource families, Inter included) for every visitor, whatever the theme
 * used. The browser only fetches a font file when text uses it, so the cost was
 * the CSS and the bundle, not the downloads, but it was still paid on every page.
 *
 * Each face is served from jsDelivr's npm mirror of the Fontsource package, at
 * the version pinned here (the same version package.json installs), one file
 * per subset and weight. The subset ranges are the standard Google ranges, so
 * a glyph outside the subsets a face ships falls back to the theme's generic
 * family, as it does for any missing glyph.
 */

export type BuiltInFace = {
  family: string
  /** Fontsource package name, also the npm path segment. */
  id: string
  /** Pinned @fontsource version (matches package.json). */
  version: string
  weights: readonly number[]
  subsets: readonly BuiltInSubset[]
}

export type BuiltInSubset = 'latin' | 'latin-ext' | 'cyrillic'

const ALL_SUBSETS: readonly BuiltInSubset[] = ['latin', 'latin-ext', 'cyrillic']

export const BUILT_IN_FACES: Readonly<Record<string, BuiltInFace>> = {
  cormorant: { family: 'Cormorant Garamond', id: 'cormorant-garamond', version: '5.3.0', weights: [400, 500, 600, 700], subsets: ALL_SUBSETS },
  playfair: { family: 'Playfair Display', id: 'playfair-display', version: '5.3.0', weights: [400, 600, 700], subsets: ALL_SUBSETS },
  cinzel: { family: 'Cinzel', id: 'cinzel', version: '5.3.0', weights: [400, 600], subsets: ['latin', 'latin-ext'] },
  jost: { family: 'Jost', id: 'jost', version: '5.3.0', weights: [300, 400, 500, 600], subsets: ALL_SUBSETS },
  montserrat: { family: 'Montserrat', id: 'montserrat', version: '5.3.0', weights: [400, 500, 600], subsets: ALL_SUBSETS },
  inter: { family: 'Inter', id: 'inter', version: '5.3.0', weights: [400, 500, 600], subsets: ALL_SUBSETS },
}

const UNICODE_RANGE: Record<BuiltInSubset, string> = {
  latin: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  'latin-ext':
    'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
  cyrillic: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116',
}

/** Built-in face keys that appear in the list, de-duplicated; unknown keys are ignored. */
export function builtInFaceKeys(values: readonly (string | null | undefined)[]): string[] {
  const out: string[] = []
  for (const value of values) {
    if (value && Object.hasOwn(BUILT_IN_FACES, value) && !out.includes(value)) out.push(value)
  }
  return out
}

/** @font-face rules for the built-in faces named, one rule per subset and weight. */
export function buildBuiltInFontCss(values: readonly (string | null | undefined)[]): string {
  const rules: string[] = []
  for (const key of builtInFaceKeys(values)) {
    const face = BUILT_IN_FACES[key]
    for (const weight of face.weights) {
      for (const subset of face.subsets) {
        const url = `https://cdn.jsdelivr.net/npm/@fontsource/${face.id}@${face.version}/files/${face.id}-${subset}-${weight}-normal.woff2`
        rules.push(
          `@font-face { font-family: "${face.family}"; font-style: normal; font-weight: ${weight}; font-display: swap; src: url("${url}") format("woff2"); unicode-range: ${UNICODE_RANGE[subset]}; }`,
        )
      }
    }
  }
  return rules.join('\n')
}
