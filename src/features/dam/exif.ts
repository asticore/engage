/**
 * Reads camera data from a JPEG's EXIF block (and the size of the file's embedded GPS, if any). Pure: bytes in,
 * plain object out, never throws. Only the tags a library shows or searches are read: make, model, lens, date taken,
 * exposure, creator and copyright, and GPS. Everything else in the block is ignored.
 */

export type ExifData = {
  camera?: string
  lens?: string
  takenAt?: string
  exposure?: string
  creator?: string
  copyright?: string
  description?: string
  gps?: { lat: number; lon: number }
}

const TAGS_IFD0: Record<number, keyof ExifData | 'make' | 'model'> = { 0x010f: 'make', 0x0110: 'model', 0x013b: 'creator', 0x8298: 'copyright', 0x010e: 'description' }

type Reader = { u16: (o: number) => number; u32: (o: number) => number }

function reader(view: DataView, little: boolean): Reader {
  return { u16: (o) => view.getUint16(o, little), u32: (o) => view.getUint32(o, little) }
}

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }

type Entry = { tag: number; type: number; count: number; offset: number }

function entries(view: DataView, r: Reader, base: number, ifd: number): Entry[] {
  const out: Entry[] = []
  if (ifd < 0 || base + ifd + 2 > view.byteLength) return out
  const n = Math.min(r.u16(base + ifd), 200)
  for (let i = 0; i < n; i++) {
    const at = base + ifd + 2 + i * 12
    if (at + 12 > view.byteLength) break
    const type = r.u16(at + 2)
    const count = r.u32(at + 4)
    const size = (TYPE_SIZE[type] ?? 0) * count
    // Values of four bytes or less sit in the entry itself, larger ones at an offset from the TIFF start.
    const offset = size <= 4 ? at + 8 : base + r.u32(at + 8)
    out.push({ tag: r.u16(at), type, count, offset })
  }
  return out
}

function text(view: DataView, e: Entry): string {
  if (e.type !== 2 || e.offset < 0 || e.offset + e.count > view.byteLength) return ''
  let s = ''
  for (let i = 0; i < Math.min(e.count, 500); i++) {
    const c = view.getUint8(e.offset + i)
    if (c === 0) break
    s += String.fromCharCode(c)
  }
  return s.trim()
}

function rationals(view: DataView, r: Reader, e: Entry): number[] {
  if ((e.type !== 5 && e.type !== 10) || e.offset + e.count * 8 > view.byteLength) return []
  const out: number[] = []
  for (let i = 0; i < Math.min(e.count, 6); i++) {
    const den = r.u32(e.offset + i * 8 + 4)
    out.push(den === 0 ? 0 : r.u32(e.offset + i * 8) / den)
  }
  return out
}

const degrees = (v: number[]): number | null => (v.length === 3 ? v[0] + v[1] / 60 + v[2] / 3600 : null)

export function parseExif(bytes: Uint8Array): ExifData {
  const out: ExifData = {}
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    if (view.byteLength < 12 || view.getUint16(0) !== 0xffd8) return out
    let pos = 2
    while (pos + 4 < view.byteLength) {
      if (view.getUint8(pos) !== 0xff) break
      const marker = view.getUint8(pos + 1)
      const length = view.getUint16(pos + 2)
      if (marker === 0xe1 && length >= 8 && view.getUint32(pos + 4) === 0x45786966) {
        const base = pos + 10
        const little = view.getUint16(base) === 0x4949
        const r = reader(view, little)
        let make = ''
        let model = ''
        let exifIfd = -1
        let gpsIfd = -1
        for (const e of entries(view, r, base, r.u32(base + 4))) {
          if (e.tag === 0x8769) exifIfd = r.u32(e.offset)
          else if (e.tag === 0x8825) gpsIfd = r.u32(e.offset)
          else {
            const name = TAGS_IFD0[e.tag]
            if (!name) continue
            const value = text(view, e)
            if (!value) continue
            if (name === 'make') make = value
            else if (name === 'model') model = value
            else out[name as 'creator' | 'copyright' | 'description'] = value
          }
        }
        if (make || model) out.camera = model.toLowerCase().startsWith(make.toLowerCase()) ? model : `${make} ${model}`.trim()
        if (exifIfd >= 0) {
          let exposureTime = ''
          let fNumber = ''
          let iso = ''
          for (const e of entries(view, r, base, exifIfd)) {
            if (e.tag === 0x9003) {
              const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(text(view, e))
              if (m) out.takenAt = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`
            } else if (e.tag === 0xa434) out.lens = text(view, e)
            else if (e.tag === 0x829a) {
              const v = rationals(view, r, e)[0]
              if (v) exposureTime = v >= 1 ? `${v}s` : `1/${Math.round(1 / v)}s`
            } else if (e.tag === 0x829d) {
              const v = rationals(view, r, e)[0]
              if (v) fNumber = `f/${Math.round(v * 10) / 10}`
            } else if (e.tag === 0x8827 && e.type === 3) iso = `ISO ${r.u16(e.offset)}`
          }
          const exposure = [exposureTime, fNumber, iso].filter(Boolean).join(' ')
          if (exposure) out.exposure = exposure
        }
        if (gpsIfd >= 0) {
          let latRef = ''
          let lonRef = ''
          let lat: number | null = null
          let lon: number | null = null
          for (const e of entries(view, r, base, gpsIfd)) {
            if (e.tag === 1) latRef = text(view, e)
            else if (e.tag === 3) lonRef = text(view, e)
            else if (e.tag === 2) lat = degrees(rationals(view, r, e))
            else if (e.tag === 4) lon = degrees(rationals(view, r, e))
          }
          if (lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
            out.gps = { lat: Math.round((latRef === 'S' ? -lat : lat) * 1e6) / 1e6, lon: Math.round((lonRef === 'W' ? -lon : lon) * 1e6) / 1e6 }
          }
        }
        break
      }
      if (marker === 0xda || length < 2) break
      pos += 2 + length
    }
  } catch {
    // Damaged metadata is ignored: the file still uploads and is searchable by everything else.
  }
  return out
}

/** The stored form: GPS dropped when the site strips it. */
export function exifForStorage(data: ExifData, stripGps: boolean): ExifData {
  if (!stripGps || !data.gps) return data
  const { gps: _gps, ...rest } = data
  return rest
}

/** Words searched for in camera data. */
export const exifSearchWords = (data: ExifData): string[] => [data.camera, data.lens, data.creator, data.copyright, data.description, data.takenAt?.slice(0, 10)].filter((v): v is string => Boolean(v))
