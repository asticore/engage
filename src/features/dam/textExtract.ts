/**
 * Plain text from a .docx or a PDF, so the words inside a document can be searched. Pure and best effort: a document this
 * cannot read gives an empty string, never an error. Only the Web Streams decompression the Workers runtime has is used.
 */

const MAX_TEXT = 20_000

async function inflate(data: Uint8Array, format: 'deflate' | 'deflate-raw'): Promise<Uint8Array> {
  const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream(format))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

const decodeEntities = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Math.min(Number(n), 0x10ffff)))
    .replace(/&amp;/g, '&')

/** Words from the XML of a Word document: paragraphs become line breaks, tags are dropped. */
export function textFromWordXml(xml: string): string {
  return decodeEntities(xml.replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, ' ').replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
}

/** Reads one entry from a zip file by name. Handles stored and deflated entries. */
export async function readZipEntry(bytes: Uint8Array, name: string): Promise<Uint8Array | null> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let end = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65_535); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i
      break
    }
  }
  if (end < 0) return null
  const count = view.getUint16(end + 10, true)
  let pos = view.getUint32(end + 16, true)
  for (let n = 0; n < count && pos + 46 <= bytes.length; n++) {
    if (view.getUint32(pos, true) !== 0x02014b50) return null
    const method = view.getUint16(pos + 10, true)
    const compressed = view.getUint32(pos + 20, true)
    const nameLength = view.getUint16(pos + 28, true)
    const extraLength = view.getUint16(pos + 30, true)
    const commentLength = view.getUint16(pos + 32, true)
    const local = view.getUint32(pos + 42, true)
    const entryName = new TextDecoder().decode(bytes.subarray(pos + 46, pos + 46 + nameLength))
    if (entryName === name) {
      if (view.getUint32(local, true) !== 0x04034b50) return null
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
      const body = bytes.subarray(start, start + compressed)
      if (method === 0) return body
      if (method === 8) return inflate(body, 'deflate-raw')
      return null
    }
    pos += 46 + nameLength + extraLength + commentLength
  }
  return null
}

export async function extractDocxText(bytes: Uint8Array): Promise<string> {
  try {
    const entry = await readZipEntry(bytes, 'word/document.xml')
    return entry ? textFromWordXml(new TextDecoder().decode(entry)).slice(0, MAX_TEXT) : ''
  } catch {
    return ''
  }
}

const unescapePdf = (s: string): string =>
  s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_m, c: string) => {
    if (/^[0-7]+$/.test(c)) return String.fromCharCode(parseInt(c, 8))
    return { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' }[c] ?? c
  })

/** The text shown by the Tj and TJ operators in one decoded PDF content stream. */
export function textFromPdfContent(content: string): string {
  const out: string[] = []
  for (const block of content.match(/BT[\s\S]*?ET/g) ?? []) {
    for (const m of block.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj|\[((?:\\.|[^\]])*)\]\s*TJ/g)) {
      if (m[1] !== undefined) out.push(unescapePdf(m[1]), ' ')
      else {
        for (const part of (m[2] ?? '').matchAll(/\(((?:\\.|[^\\)])*)\)/g)) out.push(unescapePdf(part[1]))
        out.push(' ')
      }
    }
    out.push(' ')
  }
  return out.join('').replace(/\s+/g, ' ').trim()
}

/** Text from a PDF's plain and Flate-compressed content streams. PDFs that use other encodings or fonts without text give less or nothing. */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  try {
    const raw = new TextDecoder('latin1').decode(bytes)
    const parts: string[] = []
    let from = 0
    for (let n = 0; n < 300 && parts.join(' ').length < MAX_TEXT; n++) {
      const open = raw.indexOf('stream', from)
      if (open < 0) break
      let start = open + 6
      if (raw[start] === '\r') start++
      if (raw[start] === '\n') start++
      const close = raw.indexOf('endstream', start)
      if (close < 0) break
      from = close + 9
      let body = bytes.subarray(start, close)
      if (body.length > 2 && body[0] === 0x78) {
        // The line break before `endstream` is not part of the data, and the decompressor refuses trailing bytes.
        let end = body.length
        while (end > 0 && (body[end - 1] === 0x0a || body[end - 1] === 0x0d)) end--
        try {
          body = await inflate(body.subarray(0, end), 'deflate').catch(() => inflate(body, 'deflate'))
        } catch {
          continue
        }
      }
      const text = textFromPdfContent(new TextDecoder('latin1').decode(body))
      if (text) parts.push(text)
    }
    return parts.join(' ').slice(0, MAX_TEXT)
  } catch {
    return ''
  }
}

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** Text from a document by its type, or an empty string for types with nothing to read. */
export async function extractText(bytes: Uint8Array, mimeType: string): Promise<string> {
  const mime = mimeType.toLowerCase()
  if (mime === DOCX) return extractDocxText(bytes)
  if (mime === 'application/pdf') return extractPdfText(bytes)
  return ''
}
