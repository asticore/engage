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

import { UNICODE_RANGE, type FontSubset } from './unicodeRanges'

export type BuiltInFace = {
  family: string
  /** Fontsource package name, also the npm path segment. */
  id: string
  /** Pinned @fontsource version (matches package.json). */
  version: string
  weights: readonly number[]
  subsets: readonly BuiltInSubset[]
}

export type BuiltInSubset = FontSubset

const LATIN_CYRILLIC: readonly BuiltInSubset[] = ['latin', 'latin-ext', 'cyrillic']
const LATIN_CYRILLIC_VIETNAMESE: readonly BuiltInSubset[] = [...LATIN_CYRILLIC, 'vietnamese']

/*
 * The subsets each face ships in @fontsource 5.3.0 (checked against the package
 * files). A subset a face does not ship has no file, so it is left out here.
 * Greek is only shipped by Inter; Vietnamese by Cormorant Garamond, Playfair
 * Display, Montserrat and Inter; Cinzel has Latin only, Jost no Vietnamese.
 */

export const BUILT_IN_FACES: Readonly<Record<string, BuiltInFace>> = {
  cormorant: { family: 'Cormorant Garamond', id: 'cormorant-garamond', version: '5.3.0', weights: [400, 500, 600, 700], subsets: LATIN_CYRILLIC_VIETNAMESE },
  playfair: { family: 'Playfair Display', id: 'playfair-display', version: '5.3.0', weights: [400, 600, 700], subsets: LATIN_CYRILLIC_VIETNAMESE },
  cinzel: { family: 'Cinzel', id: 'cinzel', version: '5.3.0', weights: [400, 600], subsets: ['latin', 'latin-ext'] },
  jost: { family: 'Jost', id: 'jost', version: '5.3.0', weights: [300, 400, 500, 600], subsets: LATIN_CYRILLIC },
  montserrat: { family: 'Montserrat', id: 'montserrat', version: '5.3.0', weights: [400, 500, 600], subsets: LATIN_CYRILLIC_VIETNAMESE },
  inter: { family: 'Inter', id: 'inter', version: '5.3.0', weights: [400, 500, 600], subsets: ['latin', 'latin-ext', 'cyrillic', 'greek', 'vietnamese'] },
}

/** Built-in face keys that appear in the list, de-duplicated; unknown keys are ignored. */
export function builtInFaceKeys(values: readonly (string | null | undefined)[]): string[] {
  const out: string[] = []
  for (const value of values) {
    if (value && Object.hasOwn(BUILT_IN_FACES, value) && !out.includes(value)) out.push(value)
  }
  return out
}

/** Where a built-in face's file is read from: jsDelivr, or this site when the admin chose to self-host (see BUILT_IN_FONT_ROUTE). */
export const BUILT_IN_FONT_ROUTE = '/font-files'

/** The file name inside a Fontsource package, for one subset and weight (normal style). */
export function builtInFontFileName(face: BuiltInFace, subset: BuiltInSubset, weight: number): string {
  return `${face.id}-${subset}-${weight}-normal.woff2`
}

/**
 * @font-face rules for the built-in faces named, one rule per subset and weight.
 * With `selfHost`, the files come from this site's own route, which copies each
 * file from the npm package the first time it is asked for (see
 * src/app/(frontend)/font-files/[...path]/route.ts). Otherwise they come from jsDelivr.
 */
export function buildBuiltInFontCss(values: readonly (string | null | undefined)[], options: { selfHost?: boolean } = {}): string {
  const rules: string[] = []
  for (const key of builtInFaceKeys(values)) {
    const face = BUILT_IN_FACES[key]
    for (const weight of face.weights) {
      for (const subset of face.subsets) {
        const url = options.selfHost
          ? `${BUILT_IN_FONT_ROUTE}/${face.id}@${face.version}/${builtInFontFileName(face, subset, weight)}`
          : `https://cdn.jsdelivr.net/npm/@fontsource/${face.id}@${face.version}/files/${builtInFontFileName(face, subset, weight)}`
        rules.push(
          `@font-face { font-family: "${face.family}"; font-style: normal; font-weight: ${weight}; font-display: swap; src: url("${url}") format("woff2"); unicode-range: ${UNICODE_RANGE[subset]}; }`,
        )
      }
    }
  }
  return rules.join('\n')
}
