/**
 * A PDF guide with no library. The developer guide's Markdown becomes styled lines, which are laid out
 * on A4 pages with the standard Helvetica and Courier fonts (nothing is embedded, so nothing is fetched).
 * Text is written as WinAnsi; characters outside Latin-1 become "?". Pure string work, so it runs in a
 * Worker. Used for the PDF download and the public guide link (`format=guide.pdf`).
 */

export type PdfStyle = 'title' | 'h2' | 'h3' | 'body' | 'code' | 'gap'
export type PdfLine = { text: string; style: PdfStyle }

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 54
const USABLE_W = PAGE_W - MARGIN * 2

/** Font resource names, object ids are set in buildPdf. */
const FONT: Record<Exclude<PdfStyle, 'gap'>, { res: 'F1' | 'F2' | 'F3'; size: number; leading: number; charWidth: number; before: number }> = {
  title: { res: 'F2', size: 20, leading: 26, charWidth: 0.55, before: 0 },
  h2: { res: 'F2', size: 14, leading: 19, charWidth: 0.55, before: 10 },
  h3: { res: 'F2', size: 11.5, leading: 16, charWidth: 0.55, before: 6 },
  body: { res: 'F1', size: 10, leading: 13.5, charWidth: 0.52, before: 0 },
  code: { res: 'F3', size: 8.5, leading: 11.5, charWidth: 0.6, before: 0 },
}

/** Common punctuation with a plain-text equivalent. Anything else outside Latin-1 becomes "?". */
const PLAIN: Record<string, string> = { '\u201c': '"', '\u201d': '"', '\u2018': "'", '\u2019': "'", '\u2013': '-', '\u2014': '-', '\u2026': '...', '\u2022': '-', '\u20ac': 'EUR', '\u00a0': ' ' }

/** Only WinAnsi-safe text: printable ASCII and Latin-1, with a few punctuation marks made plain. Everything else becomes "?". */
export function winAnsi(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 63
    if (code === 9) out += ' '
    else if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255)) out += ch
    else out += PLAIN[ch] ?? '?'
  }
  return out
}

const escapePdf = (text: string): string => text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

/** Splits one paragraph into lines no wider than `maxChars`, at spaces. A word longer than a line is cut. */
export function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    let rest = word
    while (rest.length > maxChars) {
      if (current) {
        lines.push(current)
        current = ''
      }
      lines.push(rest.slice(0, maxChars))
      rest = rest.slice(maxChars)
    }
    if (!current) current = rest
    else if (current.length + 1 + rest.length <= maxChars) current += ` ${rest}`
    else {
      lines.push(current)
      current = rest
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

/** The guide's Markdown as PDF lines: headings, code blocks, table rows, bullets and paragraphs. Backticks and bold marks are dropped. */
export function markdownToPdfLines(markdown: string): PdfLine[] {
  const out: PdfLine[] = []
  let inCode = false
  const plain = (s: string): string => s.replace(/`/g, '').replace(/\*\*/g, '')
  for (const raw of markdown.split('\n')) {
    if (raw.startsWith('```')) {
      inCode = !inCode
      if (!inCode) out.push({ text: '', style: 'gap' })
      continue
    }
    if (inCode) {
      out.push({ text: raw, style: 'code' })
      continue
    }
    if (raw.startsWith('# ')) out.push({ text: plain(raw.slice(2)), style: 'title' })
    else if (raw.startsWith('## ')) out.push({ text: plain(raw.slice(3)), style: 'h2' })
    else if (raw.startsWith('### ')) out.push({ text: plain(raw.slice(4)), style: 'h3' })
    else if (raw.startsWith('|')) {
      if (/^\|\s*-{3,}/.test(raw)) continue
      const cells = raw.split('|').slice(1, -1).map((c) => plain(c.trim()))
      out.push({ text: cells.join('   |   '), style: 'body' })
    } else if (raw.startsWith('- ')) out.push({ text: `- ${plain(raw.slice(2))}`, style: 'body' })
    else if (raw.trim() === '') out.push({ text: '', style: 'gap' })
    else out.push({ text: plain(raw), style: 'body' })
  }
  return out
}

type Row = { text: string; res: 'F1' | 'F2' | 'F3'; size: number; advance: number; gap?: boolean }

/** Lays the lines out as rows, one per printed line, with their font and the vertical room they take. */
function rowsOf(lines: PdfLine[]): Row[] {
  const rows: Row[] = []
  for (const line of lines) {
    if (line.style === 'gap') {
      rows.push({ text: '', res: 'F1', size: 10, advance: 8, gap: true })
      continue
    }
    const f = FONT[line.style]
    const maxChars = Math.max(10, Math.floor(USABLE_W / (f.size * f.charWidth)))
    const parts = line.style === 'code' ? hardWrap(winAnsi(line.text), maxChars) : wrapText(winAnsi(line.text), maxChars)
    parts.forEach((part, i) => rows.push({ text: part, res: f.res, size: f.size, advance: f.leading + (i === 0 ? f.before : 0) }))
  }
  return rows
}

function hardWrap(text: string, maxChars: number): string[] {
  if (text.length === 0) return ['']
  const out: string[] = []
  for (let i = 0; i < text.length; i += maxChars) out.push(text.slice(i, i + maxChars))
  return out
}

/** An image drawn at the top of the first page. `data` is already in the form the filter expects (a JPEG file, or PNG zlib data with PNG predictors). */
export type PdfLogo = { width: number; height: number; components: 1 | 3; filter: 'DCTDecode' | 'FlateDecode'; data: Uint8Array }

const LOGO_MAX_W = 160
const LOGO_MAX_H = 48

/** Size the logo is drawn at in points: fits the box, never enlarged past its own pixels. */
export function logoSize(logo: Pick<PdfLogo, 'width' | 'height'>): { w: number; h: number } {
  const scale = Math.min(LOGO_MAX_W / logo.width, LOGO_MAX_H / logo.height, 1)
  return { w: logo.width * scale, h: logo.height * scale }
}

const latin1 = (bytes: Uint8Array): string => {
  let out = ''
  for (let i = 0; i < bytes.length; i += 8192) out += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return out
}

/** Builds the PDF file. `title` goes into the document information. A logo, when given, sits above the text on the first page. */
export function buildPdf(lines: PdfLine[], title: string, logo?: PdfLogo | null): Uint8Array<ArrayBuffer> {
  const size = logo ? logoSize(logo) : null
  const rows = rowsOf(logo ? [{ text: '', style: 'gap' as const }, ...Array(Math.ceil((size?.h ?? 0) / 8)).fill({ text: '', style: 'gap' as const }), ...lines] : lines)
  // Pages: a list of content streams.
  const pages: string[][] = []
  let current: string[] = []
  let y = PAGE_H - MARGIN
  for (const row of rows) {
    if (row.gap) {
      y -= row.advance
      continue
    }
    if (y - row.size - 2 < MARGIN) {
      pages.push(current)
      current = []
      y = PAGE_H - MARGIN
    }
    y -= row.advance
    if (row.text) current.push(`BT /${row.res} ${row.size} Tf 1 0 0 1 ${MARGIN} ${y.toFixed(1)} Tm (${escapePdf(row.text)}) Tj ET`)
  }
  pages.push(current)

  const pageCount = pages.length
  // Object ids: 1 catalog, 2 pages, 3-5 fonts, 6 info, then a page and a content stream per page.
  const imageId = 7
  const first = logo ? 8 : 7
  const pageId = (i: number): number => first + i * 2
  const contentId = (i: number): number => first + 1 + i * 2
  const objects: string[] = []
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[2] = `<< /Type /Pages /Kids [${pages.map((_, i) => `${pageId(i)} 0 R`).join(' ')}] /Count ${pageCount} >>`
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
  objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>'
  objects[6] = `<< /Title (${escapePdf(winAnsi(title))}) /Producer (Engage API builder) >>`
  if (logo) {
    const decode = logo.filter === 'FlateDecode' ? ` /DecodeParms << /Predictor 15 /Colors ${logo.components} /BitsPerComponent 8 /Columns ${logo.width} >>` : ''
    const bytes = latin1(logo.data)
    objects[imageId] = `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /${logo.components === 3 ? 'DeviceRGB' : 'DeviceGray'} /BitsPerComponent 8 /Filter /${logo.filter}${decode} /Length ${bytes.length} >>\nstream\n${bytes}\nendstream`
  }
  pages.forEach((content, i) => {
    const footer = `BT /F1 8 Tf 1 0 0 1 ${PAGE_W - MARGIN - 40} 30 Tm (${i + 1} / ${pageCount}) Tj ET`
    const image = logo && size && i === 0 ? [`q ${size.w.toFixed(1)} 0 0 ${size.h.toFixed(1)} ${MARGIN} ${(PAGE_H - MARGIN - size.h + 8).toFixed(1)} cm /Im1 Do Q`] : []
    const stream = [...image, ...content, footer].join('\n')
    const xobject = logo && i === 0 ? ` /XObject << /Im1 ${imageId} 0 R >>` : ''
    objects[pageId(i)] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >>${xobject} >> /Contents ${contentId(i)} 0 R >>`
    objects[contentId(i)] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  })

  const total = objects.length
  let body = '%PDF-1.4\n%âãÏÓ\n'
  const offsets: number[] = []
  for (let id = 1; id < total; id++) {
    offsets[id] = body.length
    body += `${id} 0 obj\n${objects[id]}\nendobj\n`
  }
  const xref = body.length
  let table = `xref\n0 ${total}\n0000000000 65535 f \n`
  for (let id = 1; id < total; id++) table += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  const trailer = `trailer\n<< /Size ${total} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  const text = body + table + trailer
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff
  return bytes
}
