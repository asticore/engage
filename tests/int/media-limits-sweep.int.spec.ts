/**
 * Known-limits sweep (1 Nov): media file types, transparency, original-named
 * files, OpenDocument spreadsheets, streamed body limits and font subsets.
 */
import { describe, expect, it } from 'vitest'
import { zipSync, strToU8 } from 'fflate'
import { ACCEPTED_TYPES, DEFAULT_UPLOAD_POLICY, inspectUpload, UploadRefusal } from '@/features/media/fileTypes'
import { chooseOutputMimeType, hasAlpha, buildOptimiseOptions, resolveOptimiseSettings } from '@/features/media/optimise'
import { isServableMediaFilename, MULTIPART_PART_BYTES, MULTIPART_THRESHOLD_BYTES } from '@/localapi/storage'
import { readLimitedText } from '@/lib/limitedBody'
import { readOds, parseSpreadsheetBytes } from '@/lib/spreadsheet'
import { localFontFileName, sanitizeInstalledFonts } from '@/features/fonts/installed'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { renderElement as renderElementNode } from '@/components/blocks/elements/renderElement'
import { isBuiltInFontFile } from '@/features/fonts/selfHost'
import { mediaOf, safeSrcSet } from '@/components/blocks/elements/elementUtil'
import { buildBuiltInFontCss } from '@/features/fonts/builtIn'

const bytes = (...values: number[]) => Uint8Array.from(values)
const text = (value: string) => new TextEncoder().encode(value)

/** A 1x1 PNG with an RGBA colour type (6): has alpha. */
const pngRgba = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'))
/** A 1x1 PNG with an RGB colour type (2): no alpha. */
const pngRgb = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64'))

const webpWith = (flags: number) => {
  const out = new Uint8Array(30)
  out.set(text('RIFF'), 0)
  out.set(text('WEBP'), 8)
  out.set(text('VP8X'), 12)
  out[20] = flags
  return out
}

describe('new file types', () => {
  it.each([
    ['photo.ico', bytes(0, 0, 1, 0, 1, 0), 'image/x-icon', 'ico'],
    ['photo.bmp', text('BM' + '\x00'.repeat(30)), 'image/bmp', 'bmp'],
    ['photo.tiff', bytes(0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8), 'image/tiff', 'tiff'],
    ['sound.ogg', text('OggS\x00\x02'), 'audio/ogg', 'ogg'],
    ['song.m4a', text('\x00\x00\x00\x18ftypM4A \x00\x00\x00\x00'), 'audio/mp4', 'm4a'],
    ['data.json', text('  {"a": 1}'), 'application/json', 'json'],
    ['note.rtf', text('{\\rtf1\\ansi hi}'), 'application/rtf', 'rtf'],
  ])('accepts %s by its bytes and stores the type found there', (name, data, mimeType) => {
    const result = inspectUpload({ name, mimetype: 'application/octet-stream', data, size: data.byteLength })
    expect(result.mimeType).toBe(mimeType)
    expect(result.name).toBe(name)
  })

  it('serves JSON and RTF only as downloads, never inline', () => {
    const inline = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'])
    for (const extension of ['json', 'rtf', 'ico', 'heic', 'bmp', 'tiff', 'ogg', 'm4a']) {
      const type = ACCEPTED_TYPES.find((entry) => entry.extension === extension)!
      expect(inline.has(type.mimeType), extension).toBe(false)
    }
  })

  it('refuses a JSON name whose contents are not JSON text', () => {
    expect(() => inspectUpload({ name: 'bad.json', mimetype: 'application/json', data: text('<html>'), size: 6 })).toThrow(UploadRefusal)
  })

  it('refuses SVG while its switch is off, and HTML always', () => {
    expect(() => inspectUpload({ name: 'logo.svg', mimetype: 'image/svg+xml', data: text('<svg></svg>'), size: 11 })).toThrow(UploadRefusal)
    expect(DEFAULT_UPLOAD_POLICY.allowedExtensions).not.toContain('svg')
    expect(() => inspectUpload({ name: 'page.html', mimetype: 'text/html', data: text('<p>x</p>'), size: 8 })).toThrow(UploadRefusal)
  })
})

describe('original-named files', () => {
  it('serves a visitor file whose name starts with "original", but never the kept copies under original/', () => {
    expect(isServableMediaFilename('original-photo.jpg')).toBe(true)
    expect(isServableMediaFilename('originals.pdf')).toBe(true)
    expect(isServableMediaFilename('original/photo.jpg')).toBe(false)
  })
})

describe('transparency', () => {
  it('detects alpha in PNG colour type 6 and not in colour type 2', () => {
    expect(hasAlpha(pngRgba, 'image/png')).toBe(true)
    expect(hasAlpha(pngRgb, 'image/png')).toBe(false)
  })

  it('detects the WebP VP8X alpha flag', () => {
    expect(hasAlpha(webpWith(0x10), 'image/webp')).toBe(true)
    expect(hasAlpha(webpWith(0x00), 'image/webp')).toBe(false)
    expect(hasAlpha(pngRgb, 'image/jpeg')).toBe(false)
  })

  it('keeps a transparent picture as WebP when the site asks for JPEG, and JPEG otherwise', () => {
    const settings = resolveOptimiseSettings({ optimisation: { provider: 'cloudflare-images', outputImageFormat: 'jpeg' } })
    expect(chooseOutputMimeType('image/png', settings, true)).toBe('image/webp')
    expect(chooseOutputMimeType('image/png', settings, false)).toBe('image/jpeg')
    expect(buildOptimiseOptions(settings, 'image/png', true).format).toBe('image/webp')
  })
})

describe('R2 multipart threshold', () => {
  it('sends files over 25 MB in parts, and keeps the parts large enough for R2', () => {
    expect(MULTIPART_THRESHOLD_BYTES).toBe(25 * 1024 * 1024)
    expect(MULTIPART_PART_BYTES).toBeGreaterThanOrEqual(5 * 1024 * 1024)
    expect(Math.ceil((100 * 1024 * 1024) / MULTIPART_PART_BYTES)).toBeLessThanOrEqual(10_000)
  })
})

describe('OpenDocument spreadsheets', () => {
  const content = `<?xml version="1.0"?><office:document-content xmlns:office="o" xmlns:table="t" xmlns:text="x"><office:body><office:spreadsheet>
<table:table table:name="Sheet1">
<table:table-row><table:table-cell office:value-type="string"><text:p>name</text:p></table:table-cell><table:table-cell office:value-type="string"><text:p>qty</text:p></table:table-cell></table:table-row>
<table:table-row><table:table-cell office:value-type="string"><text:p>widget &amp; co</text:p></table:table-cell><table:table-cell office:value-type="float" office:value="3"><text:p>3</text:p></table:table-cell></table:table-row>
<table:table-row table:number-rows-repeated="1000000"><table:table-cell table:number-columns-repeated="1000000"/></table:table-row>
<table:table-row><table:table-cell office:value-type="boolean" office:boolean-value="true"><text:p>TRUE</text:p></table:table-cell><table:table-cell table:number-columns-repeated="2" office:value-type="float" office:value="7"/></table:table-row>
</table:table></office:spreadsheet></office:body></office:document-content>`

  const file = (xml: string) => zipSync({ mimetype: strToU8('application/vnd.oasis.opendocument.spreadsheet'), 'content.xml': strToU8(xml) })

  it('reads the first sheet, decoding entities and numbers, and skips empty rows without expanding them', () => {
    const result = readOds(file(content), { maxRows: 100 })
    expect(result.rows).toEqual([
      ['name', 'qty'],
      ['widget & co', '3'],
      ['TRUE', '7', '7'],
    ])
    expect(result.truncated).toBe(false)
  })

  it('stops at the row limit and says so', () => {
    const result = readOds(file(content), { maxRows: 2 })
    expect(result.rows).toHaveLength(2)
    expect(result.truncated).toBe(true)
  })

  it('is chosen by file name in the spreadsheet reader and refuses a file that is not an ODS zip', () => {
    const ok = parseSpreadsheetBytes('stock.ods', file(content))
    expect(ok.ok && ok.kind).toBe('ods')
    const bad = parseSpreadsheetBytes('stock.ods', text('not a zip at all'))
    expect(bad.ok).toBe(false)
  })
})

describe('streamed body limit', () => {
  it('counts the bytes that arrive, so a body without an honest Content-Length is still capped', async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(text('x'.repeat(60)))
        controller.enqueue(text('x'.repeat(60)))
        controller.close()
      },
    })
    const request = new Request('https://example.test/api/x', { method: 'POST', body, duplex: 'half' } as RequestInit)
    const result = await readLimitedText(request, 100, 'Too big.')
    expect('response' in result && result.response.status).toBe(413)
  })

  it('returns the text of a body within the limit', async () => {
    const request = new Request('https://example.test/api/x', { method: 'POST', body: '{"ok":true}' })
    const result = await readLimitedText(request, 100, 'Too big.')
    expect('text' in result && result.text).toBe('{"ok":true}')
  })
})

describe('font subsets and versions', () => {
  it('names a non-latin subset file apart from the latin one', () => {
    expect(localFontFileName('lato', 400, 'normal', 'woff2')).toBe('font-lato-400-normal.woff2')
    expect(localFontFileName('lato', 400, 'normal', 'woff2', 'cyrillic')).toBe('font-lato-cyrillic-400-normal.woff2')
  })

  it('keeps a valid version and subsets, and drops an unpinned or unknown version', () => {
    const [font] = sanitizeInstalledFonts([
      { id: 'lato', family: 'Lato', source: 'fontsource', weights: [400], italic: false, local: false, files: {}, version: '5.2.6', subsets: ['cyrillic', 'nope'] },
    ])
    expect(font.version).toBe('5.2.6')
    expect(font.subsets).toEqual(['cyrillic'])
    const [legacy] = sanitizeInstalledFonts([{ id: 'lato', family: 'Lato', source: 'fontsource', weights: [400], version: 'latest' }])
    expect(legacy.version).toBeUndefined()
    expect(legacy.subsets).toEqual(['latin'])
  })
})

const renderElement = (type: string, props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(React.Fragment, null, renderElementNode(type, props)))

describe('self-hosted built-in fonts and block srcset', () => {
  it('serves only the pinned built-in files, and only names it could have been asked for', () => {
    expect(isBuiltInFontFile('inter@5.3.0', 'inter-latin-400-normal.woff2')).toBe(true)
    expect(isBuiltInFontFile('inter@5.2.0', 'inter-latin-400-normal.woff2')).toBe(false)
    expect(isBuiltInFontFile('inter@5.3.0', 'inter-latin-999-normal.woff2')).toBe(false)
    expect(isBuiltInFontFile('lato@5.3.0', 'lato-latin-400-normal.woff2')).toBe(false)
  })

  it('points built-in font faces at this site when self-hosted, and at jsDelivr otherwise', () => {
    expect(buildBuiltInFontCss(['inter'], { selfHost: true })).toContain('url("/font-files/inter@5.3.0/inter-latin-400-normal.woff2")')
    expect(buildBuiltInFontCss(['inter'])).toContain('https://cdn.jsdelivr.net/npm/@fontsource/inter@5.3.0/files/')
  })

  it('accepts only server-built srcset candidates, and reads srcSet from the stored picture only when it is valid', () => {
    expect(safeSrcSet('/cdn-cgi/image/width=640,format=webp/media/a.jpg 640w, /cdn-cgi/image/width=1280/media/a.jpg 1280w')).toBeDefined()
    expect(safeSrcSet('https://evil.example/a.jpg 640w" onload="x')).toBeUndefined()
    expect(safeSrcSet('javascript:alert(1) 1w')).toBeUndefined()
    expect(mediaOf({ id: 1, url: '/media/a.jpg', srcSet: '/media/a.jpg 640w' })?.srcSet).toBe('/media/a.jpg 640w')
    expect(mediaOf({ id: 1, url: '/media/a.jpg', srcSet: 'javascript:1 1w' })?.srcSet).toBeUndefined()
  })

  it('gives every block picture with a srcset a sizes attribute, and none without one', () => {
    const srcSet = '/media/a.jpg 640w, /media/a.jpg 1280w'
    const photo = { id: 1, url: '/media/a.jpg', alt: 'Ada', srcSet }
    const card = renderElement('card', { title: 'Card', media: 'image', imageRatio: 'auto', image: photo })
    const team = renderElement('team-member', { name: 'Ada', photo })
    const box = renderElement('image-box', { title: 'Box', image: photo })
    const grid = renderElement('gallery', { images: [photo, photo], columns: 3 })
    const carousel = renderElement('image-carousel', { images: [photo], visible: 2 })
    const plain = renderElement('team-member', { name: 'Ada', photo: { id: 1, url: '/media/a.jpg' } })
    for (const markup of [card, box, grid, carousel]) {
      expect(markup).toContain(`srcSet="${srcSet}"`)
      expect(markup).toMatch(/sizes="\(max-width: 720px\) [^"]+, [^"]+"/)
    }
    expect(team).toContain(`srcSet="${srcSet}"`)
    expect(team).toContain('sizes="min(100vw, 280px)"')
    expect(grid).toContain('sizes="(max-width: 720px) 50vw, 34vw"')
    expect(carousel).toContain('sizes="(max-width: 720px) 100vw, 50vw"')
    expect(plain).not.toContain('srcSet=')
    expect(plain).not.toContain('sizes=')
  })
})

