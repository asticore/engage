/** Named rendition presets (Task 29g): a size, a fit and a format a picture can be downloaded in. Pure rules. */

export const FITS = ['scale-down', 'contain', 'cover', 'crop', 'pad'] as const
export const FORMATS = ['auto', 'jpeg', 'png', 'webp', 'avif'] as const
export type Fit = (typeof FITS)[number]
export type Format = (typeof FORMATS)[number]
export type Rendition = { id: number; name: string; width: number; height: number; fit: Fit; format: Format }
export type RenditionInput = Omit<Rendition, 'id'>

const MIME: Record<Exclude<Format, 'auto'>, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' }
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' }

export function parseRendition(input: Record<string, unknown>, existing: Rendition[], selfId: number | null): { ok: true; value: RenditionInput } | { ok: false; error: string } {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (!name || name.length > 60) return { ok: false, error: 'Give the preset a name up to 60 characters.' }
  if (existing.some((r) => r.id !== selfId && r.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: 'A preset with that name exists.' }
  const dim = (v: unknown): number | null => (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 8000 ? Number(v) : null)
  const width = dim(input.width)
  const height = dim(input.height)
  if (width === null || height === null) return { ok: false, error: 'Width and height are whole numbers up to 8000.' }
  if (width === 0 && height === 0) return { ok: false, error: 'Set a width, a height or both.' }
  const fit = (FITS as readonly string[]).includes(String(input.fit)) ? (input.fit as Fit) : 'scale-down'
  const format = (FORMATS as readonly string[]).includes(String(input.format)) ? (input.format as Format) : 'auto'
  if ((fit === 'cover' || fit === 'crop' || fit === 'pad') && (width === 0 || height === 0)) return { ok: false, error: 'Cover, crop and pad need both a width and a height.' }
  return { ok: true, value: { name, width, height, fit, format } }
}

/** The mime type a preset produces for a source picture. */
export function outputMime(format: Format, sourceMime: string): string {
  if (format !== 'auto') return MIME[format]
  return EXT[sourceMime] ? sourceMime : 'image/webp'
}

/** `photo.jpg` through preset `Web small` becomes `photo-web-small.webp`. */
export function renditionFileName(filename: string, presetName: string, mime: string): string {
  const base = filename.replace(/\.[^.]*$/, '')
  const slug = presetName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'rendition'
  return `${base}-${slug}.${EXT[mime] ?? 'img'}`
}

/** Pictures the Images service can transform. */
export const isRenderable = (mime: string): boolean => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime)
