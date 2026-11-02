/**
 * The built-in font faces the site theme can pick, as CSS variables. The site layout and the embed layout both
 * read these, so a face is named in one place. The variables are set on :root; the faces themselves are loaded
 * by features/fonts/builtIn.ts.
 */

export const FONT_FACE_VARS =
  "--font-cormorant: 'Cormorant Garamond', serif; " +
  "--font-playfair: 'Playfair Display', serif; " +
  "--font-cinzel: 'Cinzel', serif; " +
  "--font-jost: 'Jost', sans-serif; " +
  "--font-montserrat: 'Montserrat', sans-serif; " +
  "--font-inter: 'Inter', sans-serif;"

export const HEADING_FONT_VARS: Record<string, string> = {
  cormorant: 'var(--font-cormorant)',
  playfair: 'var(--font-playfair)',
  cinzel: 'var(--font-cinzel)',
}

export const BODY_FONT_VARS: Record<string, string> = {
  jost: 'var(--font-jost)',
  montserrat: 'var(--font-montserrat)',
  inter: 'var(--font-inter)',
}
