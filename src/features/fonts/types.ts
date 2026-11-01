/**
 * Shared shapes for admin-installed site fonts.
 *
 * Pure types only - this module is imported by the admin field components
 * (browser bundle), the public layout (server), the install/upload routes and
 * the tests, so it must not pull in anything Node- or Workers-specific.
 */

/**
 * Where the font's files come from.
 *  - `google`: a Google Fonts family. Remote use loads the Google CSS2 stylesheet.
 *  - `fontsource`: an open-licence family from the Fontsource catalog that is not
 *    on Google Fonts. Remote use loads the woff2 files from jsDelivr.
 *  - `upload`: a font file the admin uploaded. Always served from this site.
 */
export type FontSource = 'google' | 'fontsource' | 'upload'

export type InstalledFont = {
  /** Lower-case slug. Stored in the theme as the heading/body value. */
  id: string
  /** Family name as written into @font-face and font stacks. */
  family: string
  source: FontSource
  category?: string
  /** Weights the admin chose to install (100-900, multiples of 100). */
  weights: number[]
  italic: boolean
  /** True when the files are hosted on this site's R2 bucket. */
  local: boolean
  /**
   * `${weight}-${style}` (for example `400-normal`, `700-italic`) to the file
   * URL. Set for `upload` fonts and for locally hosted fonts; empty otherwise.
   * A subset other than latin adds it to the key (`400-normal-cyrillic`).
   */
  files: Record<string, string>
  /**
   * Fontsource package version the files were taken from (exact, for example
   * `5.2.6`). Fonts installed before this was recorded have none and keep the
   * unpinned jsDelivr path until they are installed again.
   */
  version?: string
  /** Character subsets chosen for a Fontsource font (latin is the default). Google fonts are split by Google's own stylesheet. */
  subsets?: string[]
  /** Weights the source offers for this family, from the catalog. A Google stylesheet only asks for weights in this list. */
  available?: number[]
}

/** One row of the Fontsource catalog, as returned by admin-fonts-search. */
export type CatalogFont = {
  id: string
  family: string
  category?: string
  weights: number[]
  styles: string[]
  subsets: string[]
  /** `google` or `other` as reported by Fontsource. */
  type: string
}

export type FontPreload = {
  href: string
  type: string
}
