/**
 * Minimal OpenDocument spreadsheet (.ods) reader. An .ods is a zip whose
 * `content.xml` holds the sheets. Reads the first table only, like the .xlsx
 * reader, using the same unzip limits and the same row and column caps.
 * Repeated rows and columns (`number-rows-repeated`, `number-columns-repeated`)
 * are expanded only as far as the caps allow, so a sheet declaring a million
 * blank rows costs nothing.
 */
import { decodeXml, extract, XlsxError, type XlsxResult } from './xlsx'

const MAX_COLUMNS = 200
const MAX_CELL_REPEAT = 200

const attrOf = (attrs: string, name: string): string | undefined => {
  const match = new RegExp(`${name}="([^"]*)"`).exec(attrs)
  return match ? decodeXml(match[1]) : undefined
}

/** Text of one cell: its paragraphs joined by new lines, with the markup removed. */
function cellText(inner: string): string {
  const paragraphs = [...inner.matchAll(/<text:p\b[^>]*>([\s\S]*?)<\/text:p>/g)].map((m) => decodeXml(m[1].replace(/<[^>]+>/g, '')))
  return paragraphs.join('\n')
}

/** The value a cell shows: numbers, dates, booleans and percentages from their stored value, text from its paragraphs. */
function cellValue(attrs: string, inner: string): string {
  const type = attrOf(attrs, 'office:value-type')
  if (type === 'float' || type === 'percentage' || type === 'currency') return attrOf(attrs, 'office:value') ?? cellText(inner)
  if (type === 'date') return attrOf(attrs, 'office:date-value') ?? cellText(inner)
  if (type === 'boolean') return (attrOf(attrs, 'office:boolean-value') ?? '').toLowerCase() === 'true' ? 'TRUE' : 'FALSE'
  return cellText(inner)
}

/** Reads the first table of an .ods file. `maxRows` counts rows returned, header included. */
export function readOds(data: Uint8Array, options: { maxRows?: number } = {}): XlsxResult {
  const maxRows = options.maxRows ?? Infinity
  if (data.length < 4 || data[0] !== 0x50 || data[1] !== 0x4b) throw new XlsxError('This file is not a valid .ods spreadsheet.')
  const parts = extract(data, (name) => name === 'content.xml')
  const xml = parts.get('content.xml')
  if (!xml) throw new XlsxError('This file is not a valid .ods spreadsheet.')

  const table = /<table:table\b[^>]*>([\s\S]*?)<\/table:table>/.exec(xml)
  if (!table) throw new XlsxError('Could not find the first sheet in this spreadsheet.')

  const rows: string[][] = []
  let truncated = false
  const rowPattern = /<table:table-row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/table:table-row>)/g
  for (const rowMatch of table[1].matchAll(rowPattern)) {
    const repeat = Math.min(Number(attrOf(rowMatch[1], 'table:number-rows-repeated') ?? 1) || 1, maxRows)
    const cells: string[] = []
    const cellPattern = /<table:(table-cell|covered-table-cell)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/table:\1>)/g
    for (const cellMatch of (rowMatch[2] ?? '').matchAll(cellPattern)) {
      const value = cellValue(cellMatch[2], cellMatch[3] ?? '')
      const times = Math.min(Number(attrOf(cellMatch[2], 'table:number-columns-repeated') ?? 1) || 1, MAX_CELL_REPEAT)
      // A run of blank cells is only kept when a later cell has content, so trailing blanks cost nothing.
      for (let i = 0; i < times && cells.length < MAX_COLUMNS; i += 1) cells.push(value)
    }
    while (cells.length > 0 && cells[cells.length - 1] === '') cells.pop()
    if (cells.length === 0) continue
    for (let i = 0; i < repeat; i += 1) {
      if (rows.length >= maxRows) {
        truncated = true
        return { rows, truncated }
      }
      rows.push([...cells])
    }
  }
  return { rows, truncated }
}
