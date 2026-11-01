/**
 * Output formats for pictures and videos (Task 12b). Pure and client-safe: the
 * gallery, the settings readers and the URL builder all use the same answers.
 *
 * Pictures: the site picks one output format (or follows the older WebP and
 * AVIF switches); a file can override it. Cloudflare image transforms write
 * AVIF, WebP, JPEG and PNG, so JPEG XL is accepted as a choice but the file is
 * kept in its own format and the UI says so.
 *
 * Videos: Cloudflare Stream makes MP4 copies, so MP4 is converted through Stream.
 * WebM is not produced by Stream, so a WebM choice keeps the file as it is.
 */

/** What a picture is delivered or stored as. `original` keeps the stored format. */
export type PictureFormat = 'original' | 'jpeg' | 'webp' | 'avif'

/** The stored values of the site picture-format setting. `switches` means the older WebP and AVIF switches decide. */
export const SITE_IMAGE_FORMAT_VALUES = ['switches', 'original', 'jpeg', 'webp', 'avif', 'jxl'] as const

/** The stored values of a file's own output format. `default` uses the site setting. */
export const FILE_OUTPUT_FORMAT_VALUES = [
  'default',
  'original',
  'jpeg',
  'webp',
  'avif',
  'jxl',
  'mp4',
  'webm',
] as const

const PICTURE_LABELS: Record<PictureFormat, string> = {
  original: 'Original',
  jpeg: 'JPEG',
  webp: 'WebP',
  avif: 'AVIF',
}

/** A stored picture-format value as the format it produces. JPEG XL and unknown values keep the original. */
export function pictureFormatOf(value: unknown): PictureFormat | null {
  if (value === 'jpeg' || value === 'webp' || value === 'avif' || value === 'original') return value
  // JPEG XL cannot be produced by Cloudflare, so it is kept as it is.
  if (value === 'jxl') return 'original'
  return null
}

/** The site's picture format: the explicit choice, or the WebP and AVIF switches when it follows them. */
export function siteImageFormat(value: unknown, webp: boolean, avif: boolean): PictureFormat {
  const explicit = pictureFormatOf(value)
  if (explicit) return explicit
  if (avif) return 'avif'
  if (webp) return 'webp'
  return 'original'
}

/**
 * The format one file ends up in: its own override when it names a picture
 * format, the site format otherwise. Videos and `default` use the site format.
 */
export function effectivePictureFormat(fileValue: unknown, site: PictureFormat): PictureFormat {
  if (fileValue === 'default' || fileValue === undefined || fileValue === null || fileValue === '') return site
  if (fileValue === 'mp4' || fileValue === 'webm') return site
  return pictureFormatOf(fileValue) ?? site
}

export function pictureFormatLabel(format: PictureFormat): string {
  return PICTURE_LABELS[format]
}

/** A short name for a stored file type, for the gallery tiles. */
export function fileTypeLabel(mimeType: string | null | undefined): string {
  if (!mimeType) return 'File'
  if (mimeType === 'video/link') return 'Video link'
  const map: Record<string, string> = {
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
    'image/webp': 'WebP',
    'image/avif': 'AVIF',
    'image/gif': 'GIF',
    'image/svg+xml': 'SVG',
    'video/mp4': 'MP4',
    'video/webm': 'WebM',
    'video/quicktime': 'MOV',
  }
  return map[mimeType] ?? mimeType.split('/')[1]?.toUpperCase() ?? 'File'
}

export function isVideoLinkMimeType(mimeType: string | null | undefined): boolean {
  return mimeType === 'video/link'
}

export function isVideoMimeType(mimeType: string | null | undefined): boolean {
  return typeof mimeType === 'string' && mimeType.startsWith('video/')
}

/** The video output format the site or a file asks for: `original`, `mp4` or `webm`. */
export function videoFormatOf(value: unknown): 'original' | 'mp4' | 'webm' {
  return value === 'mp4' || value === 'webm' ? value : 'original'
}

/** The format a video file is converted to: its own override, else the site setting. */
export function effectiveVideoFormat(fileValue: unknown, site: unknown): 'original' | 'mp4' | 'webm' {
  if (fileValue === 'mp4' || fileValue === 'webm') return fileValue
  if (fileValue === 'original') return 'original'
  return videoFormatOf(site)
}
