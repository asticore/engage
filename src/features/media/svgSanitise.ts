/**
 * Strict SVG sanitiser for the media library. Runs only when Media settings > Uploads > "Allow SVG uploads" is on.
 *
 * Allow-list, not block-list: an element or attribute that is not on the lists below is dropped (an element
 * together with everything inside it), so a new SVG feature stays off until someone adds it here on purpose.
 *
 * Removed:
 *   - script, style, foreignObject, every animation element and every other element not listed
 *   - event attributes (on*) and every attribute not listed
 *   - href and xlink:href that point anywhere but a fragment (#id) or an inline raster picture (png, jpeg, gif, webp)
 *   - javascript:, vbscript:, and any data: address that is not an inline raster picture, in any attribute
 *   - url(...) that is not a fragment reference, @import, expression(), behavior and -moz-binding
 *
 * Refused (the whole file is turned away): DOCTYPE and entity declarations, processing instructions other than
 * the XML declaration, character references that are not valid, unbalanced tags, text outside the picture, and
 * a root element that is not svg.
 *
 * The output is rebuilt from the tokens that pass, so comments, the XML declaration and whitespace between tags are
 * not copied. Running the output through again gives the same bytes.
 */

export type SvgSanitiseResult = { ok: true; bytes: Uint8Array; text: string } | { ok: false; reason: string }

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink'

/** Elements that draw, group or describe a picture. Everything else is dropped with its contents. */
const ELEMENTS = new Set([
  'svg', 'g', 'defs', 'symbol', 'use', 'switch',
  'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'textPath', 'title', 'desc',
  'linearGradient', 'radialGradient', 'stop', 'pattern', 'clipPath', 'mask', 'marker',
  'image', 'a', 'filter',
  'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite', 'feConvolveMatrix', 'feDiffuseLighting',
  'feDisplacementMap', 'feDistantLight', 'feDropShadow', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR',
  'feGaussianBlur', 'feImage', 'feMerge', 'feMergeNode', 'feMorphology', 'feOffset', 'fePointLight',
  'feSpecularLighting', 'feSpotLight', 'feTile', 'feTurbulence',
])

/** Attributes kept on the listed elements. Names are case sensitive, as in SVG. */
const ATTRIBUTES = new Set([
  'id', 'class', 'transform', 'viewBox', 'preserveAspectRatio', 'version',
  'x', 'y', 'dx', 'dy', 'rotate', 'width', 'height', 'r', 'rx', 'ry', 'cx', 'cy', 'fx', 'fy', 'fr',
  'x1', 'x2', 'y1', 'y2', 'd', 'points', 'pathLength', 'offset', 'startOffset', 'method', 'spacing', 'side',
  'textLength', 'lengthAdjust', 'stop-color', 'stop-opacity',
  'gradientUnits', 'gradientTransform', 'spreadMethod',
  'patternUnits', 'patternContentUnits', 'patternTransform', 'clipPathUnits', 'maskUnits', 'maskContentUnits',
  'markerWidth', 'markerHeight', 'markerUnits', 'refX', 'refY', 'orient',
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin',
  'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'color', 'display', 'visibility',
  'clip-path', 'clip-rule', 'mask', 'filter', 'marker-start', 'marker-mid', 'marker-end',
  'font-family', 'font-size', 'font-style', 'font-weight', 'font-variant', 'font-stretch',
  'text-anchor', 'text-decoration', 'letter-spacing', 'word-spacing', 'dominant-baseline', 'alignment-baseline',
  'baseline-shift', 'writing-mode', 'direction', 'unicode-bidi', 'overflow', 'vector-effect', 'shape-rendering',
  'image-rendering', 'text-rendering', 'paint-order', 'isolation', 'mix-blend-mode',
  'color-interpolation', 'color-interpolation-filters', 'color-rendering',
  'style', 'href', 'xlink:href', 'xml:space', 'xml:lang',
  'in', 'in2', 'result', 'stdDeviation', 'mode', 'values', 'type', 'operator', 'k1', 'k2', 'k3', 'k4',
  'flood-color', 'flood-opacity', 'lighting-color', 'scale', 'xChannelSelector', 'yChannelSelector', 'radius', 'order',
  'kernelMatrix', 'divisor', 'bias', 'targetX', 'targetY', 'edgeMode', 'kernelUnitLength', 'surfaceScale',
  'diffuseConstant', 'specularConstant', 'specularExponent', 'tableValues', 'slope', 'intercept', 'amplitude',
  'exponent', 'baseFrequency', 'numOctaves', 'seed', 'stitchTiles', 'filterUnits', 'primitiveUnits', 'preserveAlpha',
  'azimuth', 'elevation', 'pointsAtX', 'pointsAtY', 'pointsAtZ', 'limitingConeAngle', 'z',
])

/** The only data: addresses allowed anywhere: an inline raster picture, whitespace removed. */
const RASTER_DATA_URL = /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]*={0,2}$/

const NAME_START = /[A-Za-z_:]/
const NAME_CHAR = /[-A-Za-z0-9_:.]/
const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

class SvgRefusal extends Error {}

/** Reads a name starting at `pos`. Returns the name and the index after it, or null when there is none. */
function readName(source: string, pos: number): { name: string; end: number } | null {
  if (pos >= source.length || !NAME_START.test(source[pos])) return null
  let end = pos + 1
  while (end < source.length && NAME_CHAR.test(source[end])) end += 1
  return { name: source.slice(pos, end), end }
}

function skipSpace(source: string, pos: number): number {
  let at = pos
  while (at < source.length && /\s/.test(source[at])) at += 1
  return at
}

/** Turns one reference body (the text between & and ;) into its character, or refuses it. */
function decodeReference(body: string): string {
  if (body.startsWith('#x') || body.startsWith('#X')) {
    if (!/^[0-9a-fA-F]+$/.test(body.slice(2))) throw new SvgRefusal('a character reference is not valid')
    const code = Number.parseInt(body.slice(2), 16)
    if (code > 0x10ffff) throw new SvgRefusal('a character reference is not valid')
    return String.fromCodePoint(code)
  }
  if (body.startsWith('#')) {
    if (!/^#\d+$/.test(body)) throw new SvgRefusal('a character reference is not valid')
    const code = Number(body.slice(1))
    if (code > 0x10ffff) throw new SvgRefusal('a character reference is not valid')
    return String.fromCodePoint(code)
  }
  if (Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, body)) return NAMED_ENTITIES[body]
  throw new SvgRefusal('the file uses an entity, which is not allowed')
}

/** Decodes every reference in a value. A lone ampersand, or a reference that is not valid XML, refuses the file. */
function decodeValue(raw: string): string {
  return raw.replace(/&([^;&\s]*);|&/g, (_match: string, body: string | undefined) => {
    if (body === undefined) throw new SvgRefusal('the file has a stray ampersand')
    return decodeReference(body)
  })
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** A link attribute keeps only a fragment (#id) or an inline raster picture. Returns the value to write, or null to drop it. */
function linkValue(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed.startsWith('#')) return /^#[^\s"'<>()]*$/.test(trimmed) ? trimmed : null
  const compact = trimmed.replace(/\s+/g, '')
  return RASTER_DATA_URL.test(compact) ? compact : null
}

/** False when a value could run code or reach outside the picture. The attribute is then dropped. */
function valueAllowed(name: string, value: string): boolean {
  // Browsers ignore whitespace and control characters inside a scheme name, so remove them before looking for schemes.
  const squashed = value.replace(/[\u0000- ]+/g, '').toLowerCase()
  if (/javascript:|vbscript:|livescript:/.test(squashed)) return false
  if (/data:/.test(squashed) && !RASTER_DATA_URL.test(value.trim())) return false
  if (/\\|@import|expression\(|behaviou?r|-moz-binding|[<>]/i.test(value)) return false
  // url(...) is allowed only as a fragment reference (a paint server, clip path, mask or filter on this picture).
  const withoutFragments = value.replace(/url\(\s*(['"]?)#[A-Za-z0-9_.:-]+\1\s*\)/gi, '')
  if (/url\s*\(/i.test(withoutFragments)) return false
  if (name === 'style' && /url\s*\(|@/i.test(value)) return false
  return true
}

type Frame = { name: string; emitted: boolean }

/**
 * Cleans an SVG file. Returns the cleaned bytes and text, or the reason it was refused. Accepts UTF-8 with or
 * without a byte order mark. Never throws.
 */
export function sanitiseSvg(input: Uint8Array | string): SvgSanitiseResult {
  let source: string
  if (typeof input === 'string') {
    source = input
  } else {
    try {
      source = new TextDecoder('utf-8', { fatal: true }).decode(input)
    } catch {
      return { ok: false, reason: 'This SVG was refused: it is not valid UTF-8 text.' }
    }
  }
  try {
    const text = clean(source.replace(/^﻿/, ''))
    return { ok: true, bytes: new TextEncoder().encode(text), text }
  } catch (error) {
    const reason = error instanceof SvgRefusal ? error.message : 'the file could not be read'
    return { ok: false, reason: `This SVG was refused: ${reason}.` }
  }
}

function clean(source: string): string {
  const out: string[] = []
  const stack: Frame[] = []
  // Number of open elements that are dropped. Nothing inside a dropped element is written.
  let hidden = 0
  let sawRoot = false
  let pos = 0

  while (pos < source.length) {
    if (source[pos] !== '<') {
      const next = source.indexOf('<', pos)
      const end = next === -1 ? source.length : next
      const segment = source.slice(pos, end)
      if (stack.length === 0) {
        if (segment.trim() !== '') throw new SvgRefusal('text appears outside the picture')
      } else {
        decodeValue(segment)
        if (hidden === 0) out.push(segment)
      }
      pos = end
      continue
    }

    if (source.startsWith('<?', pos)) {
      const end = source.indexOf('?>', pos)
      if (end === -1) throw new SvgRefusal('a processing instruction is not closed')
      if (pos === 0 && /^<\?xml\s/.test(source.slice(0, end + 2))) {
        pos = end + 2
        continue
      }
      throw new SvgRefusal('the file contains a processing instruction, which is not allowed')
    }

    if (source.startsWith('<!--', pos)) {
      const end = source.indexOf('-->', pos + 4)
      if (end === -1) throw new SvgRefusal('a comment is not closed')
      pos = end + 3
      continue
    }

    if (source.startsWith('<![CDATA[', pos)) {
      const end = source.indexOf(']]>', pos)
      if (end === -1) throw new SvgRefusal('a CDATA section is not closed')
      const body = source.slice(pos + 9, end)
      if (stack.length === 0) {
        if (body.trim() !== '') throw new SvgRefusal('text appears outside the picture')
      } else if (hidden === 0) {
        // Written as escaped text, so it can never read as markup.
        out.push(body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
      }
      pos = end + 3
      continue
    }

    if (source.startsWith('<!', pos)) throw new SvgRefusal('the file declares a DOCTYPE or an entity, which is not allowed')

    if (source.startsWith('</', pos)) {
      const named = readName(source, pos + 2)
      if (!named) throw new SvgRefusal('a closing tag is not valid')
      const close = skipSpace(source, named.end)
      if (source[close] !== '>') throw new SvgRefusal('a closing tag is not valid')
      const frame = stack.pop()
      if (!frame || frame.name !== named.name) throw new SvgRefusal('the tags are not nested correctly')
      if (frame.emitted) out.push(`</${frame.name}>`)
      else hidden -= 1
      pos = close + 1
      continue
    }

    // Opening tag: name, then attributes separated by whitespace, then > or />.
    const tag = readName(source, pos + 1)
    if (!tag) throw new SvgRefusal('a tag is not valid')
    const topLevel = stack.length === 0
    if (topLevel && sawRoot) throw new SvgRefusal('the picture has more than one top-level element')
    if (topLevel && tag.name !== 'svg') throw new SvgRefusal('the file is not an SVG picture (its root element is not svg)')
    if (topLevel) sawRoot = true

    const attributes: Array<[string, string]> = []
    let cursor = tag.end
    for (;;) {
      const afterSpace = skipSpace(source, cursor)
      if (source[afterSpace] === '>' || source.startsWith('/>', afterSpace)) {
        cursor = afterSpace
        break
      }
      // Attributes must be separated by whitespace.
      if (afterSpace === cursor) throw new SvgRefusal('a tag is not valid')
      const attr = readName(source, afterSpace)
      if (!attr) throw new SvgRefusal('a tag is not valid')
      const equals = skipSpace(source, attr.end)
      if (source[equals] !== '=') throw new SvgRefusal('an attribute has no value')
      const quoteAt = skipSpace(source, equals + 1)
      const quote = source[quoteAt]
      if (quote !== '"' && quote !== "'") throw new SvgRefusal('an attribute value is not quoted')
      const close = source.indexOf(quote, quoteAt + 1)
      if (close === -1) throw new SvgRefusal('an attribute value is not closed')
      attributes.push([attr.name, source.slice(quoteAt + 1, close)])
      cursor = close + 1
    }
    const selfClosing = source.startsWith('/>', cursor)
    if (!selfClosing && source[cursor] !== '>') throw new SvgRefusal('a tag is not valid')
    const after = cursor + (selfClosing ? 2 : 1)

    if (hidden > 0 || !ELEMENTS.has(tag.name)) {
      if (!selfClosing) {
        stack.push({ name: tag.name, emitted: false })
        hidden += 1
      }
      pos = after
      continue
    }

    const rendered: string[] = []
    for (const [name, raw] of attributes) {
      if (/^on/i.test(name)) continue
      if (name === 'xmlns') {
        if (decodeValue(raw) === SVG_NAMESPACE) rendered.push(`xmlns="${SVG_NAMESPACE}"`)
        continue
      }
      if (name === 'xmlns:xlink') {
        if (decodeValue(raw) === XLINK_NAMESPACE) rendered.push(`xmlns:xlink="${XLINK_NAMESPACE}"`)
        continue
      }
      if (!ATTRIBUTES.has(name)) continue
      const value = decodeValue(raw)
      if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) continue
      if (name === 'href' || name === 'xlink:href') {
        const link = linkValue(value)
        if (link !== null) rendered.push(`${name}="${escapeAttribute(link)}"`)
        continue
      }
      if (!valueAllowed(name, value)) continue
      rendered.push(`${name}="${escapeAttribute(value)}"`)
    }

    const open = rendered.length > 0 ? `<${tag.name} ${rendered.join(' ')}` : `<${tag.name}`
    if (selfClosing) {
      out.push(`${open}/>`)
    } else {
      out.push(`${open}>`)
      stack.push({ name: tag.name, emitted: true })
    }
    pos = after
  }

  if (stack.length > 0) throw new SvgRefusal('the picture ends before its tags are closed')
  if (!sawRoot) throw new SvgRefusal('the file has no picture in it')
  return out.join('')
}
