/**
 * Data feed formats for a list endpoint: CSV, JSON lines and XML, next to the two JSON shapes.
 * Pure: rows in, text out. A feed endpoint is an ordinary endpoint (same key, scopes, filters, fields
 * and rate limit); only the body changes. Spreadsheet formula characters at the start of a cell are
 * defused, so a feed opened in Excel or Sheets cannot run a formula that a visitor typed into a field.
 */

export const FEED_FORMATS = ['csv', 'jsonl', 'xml'] as const
export type FeedFormat = (typeof FEED_FORMATS)[number]
export const isFeedFormat = (value: unknown): value is FeedFormat => typeof value === 'string' && (FEED_FORMATS as readonly string[]).includes(value)

export const FEED_CONTENT_TYPES: Record<FeedFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  jsonl: 'application/x-ndjson; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
}

export type FeedRow = Record<string, unknown>

const scalar = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

const FORMULA_START = /^[=+\-@\t\r]/

/** One CSV cell, quoted when needed, with a leading formula character neutralised. */
export function csvCell(value: unknown): string {
  let text = scalar(value)
  if (FORMULA_START.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** The columns of a feed: `id` first, then the exposed fields in the order given. */
export function feedColumns(fields: readonly string[], rows: readonly FeedRow[]): string[] {
  const out = ['id']
  for (const field of fields) if (!out.includes(field)) out.push(field)
  for (const row of rows) for (const key of Object.keys(row)) if (!out.includes(key)) out.push(key)
  return out
}

export function toCsv(rows: readonly FeedRow[], fields: readonly string[]): string {
  const columns = feedColumns(fields, rows)
  const lines = [columns.map(csvCell).join(',')]
  for (const row of rows) lines.push(columns.map((c) => csvCell(row[c])).join(','))
  return lines.join('\r\n') + '\r\n'
}

export function toJsonLines(rows: readonly FeedRow[]): string {
  return rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length > 0 ? '\n' : '')
}

const xmlEscape = (text: string): string =>
  text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** An element name safe for XML: letters, digits, hyphen and underscore, starting with a letter. */
export const xmlName = (key: string): string => {
  const cleaned = key.replace(/[^A-Za-z0-9_-]/g, '_')
  return /^[A-Za-z]/.test(cleaned) ? cleaned : `f_${cleaned}`
}

function xmlValue(value: unknown, name: string): string {
  if (Array.isArray(value)) return `<${name}>${value.map((item) => xmlValue(item, 'item')).join('')}</${name}>`
  if (value && typeof value === 'object') {
    return `<${name}>${Object.entries(value as Record<string, unknown>).map(([k, v]) => xmlValue(v, xmlName(k))).join('')}</${name}>`
  }
  return `<${name}>${xmlEscape(scalar(value))}</${name}>`
}

export function toXml(rows: readonly FeedRow[], root: string): string {
  const body = rows.map((row) => `<item>${Object.entries(row).map(([k, v]) => xmlValue(v, xmlName(k))).join('')}</item>`).join('')
  const name = xmlName(root)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<${name}>${body}</${name}>\n`
}

export function renderFeed(format: FeedFormat, rows: readonly FeedRow[], fields: readonly string[], root: string): string {
  if (format === 'csv') return toCsv(rows, fields)
  if (format === 'jsonl') return toJsonLines(rows)
  return toXml(rows, root)
}
