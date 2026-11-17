import type { PdfLogo } from '@/features/apiBuilder/pdf'

/**
 * Turns a logo file into something a PDF can draw without any image library. A JPEG (grey or colour) is embedded as it is. A PNG is
 * embedded when it is 8-bit grey or colour, not interlaced and without transparency: its zlib data is passed through with PNG predictors.
 * Anything else (transparent PNG, palette, WebP, SVG) gives null and the report shows the name only. Pure byte work.
 */

export const MAX_LOGO_BYTES = 1_500_000

const u32 = (b: Uint8Array, i: number): number => ((b[i] ?? 0) * 16_777_216) + (((b[i + 1] ?? 0) << 16) | ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0))

function fromJpeg(b: Uint8Array): PdfLogo | null {
  let i = 2
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null
    const marker = b[i + 1] ?? 0
    if (marker === 0xff) {
      i += 1
      continue
    }
    const length = ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0)
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isFrame) {
      if (marker !== 0xc0 && marker !== 0xc1) return null // progressive JPEGs are not drawn by every reader
      const height = ((b[i + 5] ?? 0) << 8) | (b[i + 6] ?? 0)
      const width = ((b[i + 7] ?? 0) << 8) | (b[i + 8] ?? 0)
      const components = b[i + 9]
      if (!width || !height || (components !== 1 && components !== 3)) return null
      return { width, height, components, filter: 'DCTDecode', data: b }
    }
    i += 2 + length
  }
  return null
}

function fromPng(b: Uint8Array): PdfLogo | null {
  let width = 0
  let height = 0
  let components: 1 | 3 = 3
  const chunks: Uint8Array[] = []
  let i = 8
  while (i + 8 <= b.length) {
    const length = u32(b, i)
    const type = String.fromCharCode(b[i + 4] ?? 0, b[i + 5] ?? 0, b[i + 6] ?? 0, b[i + 7] ?? 0)
    const start = i + 8
    if (start + length > b.length) return null
    if (type === 'IHDR') {
      width = u32(b, start)
      height = u32(b, start + 4)
      const depth = b[start + 8]
      const colour = b[start + 9]
      const interlace = b[start + 12]
      if (depth !== 8 || interlace !== 0 || (colour !== 0 && colour !== 2)) return null
      components = colour === 0 ? 1 : 3
    } else if (type === 'IDAT') chunks.push(b.subarray(start, start + length))
    else if (type === 'tRNS') return null
    else if (type === 'IEND') break
    i = start + length + 4
  }
  if (!width || !height || chunks.length === 0) return null
  const data = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0))
  let at = 0
  for (const c of chunks) {
    data.set(c, at)
    at += c.length
  }
  return { width, height, components, filter: 'FlateDecode', data }
}

/** The logo as a PDF image, or null when it cannot be drawn (or is too big). */
export function parseLogo(bytes: Uint8Array): PdfLogo | null {
  if (bytes.length < 24 || bytes.length > MAX_LOGO_BYTES) return null
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return fromJpeg(bytes)
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return fromPng(bytes)
  return null
}
