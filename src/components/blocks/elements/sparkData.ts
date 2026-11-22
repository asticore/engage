/**
 * Shared helpers for the elements that render with Spark (asticore/spark): the Chart element and the Table element.
 * Pure functions, no React and no catalogue, so a renderer can import them cheaply.
 */

export const SPARK_ATTR = 'data-spark-'
const ATTR_NAME_RE = /^[a-z][a-z0-9-]{0,30}$/
/** A colour Spark may take: hex, rgb(), hsl(), a CSS variable or a Shine tone name. Anything else is dropped. */
const COLOR_TOKEN_RE = /^(#[0-9a-f]{3,8}|(?:rgb|hsl)a?\([\d\s.,%/+-]+\)|var\(--[a-z0-9-]+\)|primary|secondary|accent|success|warning|danger|info|neutral|transparent|currentcolor)$/i
const MAX_CSV_CHARS = 200_000

/** Parses CSV text (quoted cells, doubled quotes, CRLF). Blank lines are skipped. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const src = text.slice(0, MAX_CSV_CHARS)
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += ch
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === ',') {
      row.push(cell.trim())
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell.trim())
      if (row.some((c) => c !== '')) rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  row.push(cell.trim())
  if (row.some((c) => c !== '')) rows.push(row)
  return rows
}

/** Quotes a cell for CSV when it holds a comma, quote or line break. */
export const csvCell = (v: string): string => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

/**
 * The first version of the Chart element stored "label | value" per line (max 12). Those rows become CSV with a header,
 * so old charts keep their data without a migration. Text that already looks like CSV is returned unchanged.
 */
export function legacyRowsToCsv(v: unknown): string {
  const text = typeof v === 'string' ? v : ''
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return ''
  if (!lines.every((l) => l.includes('|') && !l.includes(','))) return text.trim()
  const out = ['Item,Value']
  for (const line of lines) {
    const at = line.indexOf('|')
    const label = line.slice(0, at).trim()
    const raw = line.slice(at + 1).trim()
    const value = Number(raw.replace(/\s/g, ''))
    if (label && raw !== '' && Number.isFinite(value)) out.push(`${csvCell(label)},${value}`)
  }
  return out.length > 1 ? out.join('\n') : ''
}

/** Colours as Spark wants them ("a|b|c"). Accepts the old comma list too. Invalid entries are dropped. */
export function sparkColors(v: unknown): string {
  return (typeof v === 'string' ? v : '')
    .split(/[|;]|,(?![^(]*\))/)
    .map((s) => s.trim())
    .filter((s) => COLOR_TOKEN_RE.test(s))
    .join('|')
}

/**
 * `data-spark-*` attributes from stored props named `<prefix><attr>`. Empty values are left out so Spark's own default
 * applies, numbers and booleans become text, and an attribute name outside [a-z0-9-] is ignored.
 */
export function sparkAttrs(props: Record<string, unknown>, prefix: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, raw] of Object.entries(props)) {
    if (!key.startsWith(prefix)) continue
    const attr = key.slice(prefix.length)
    if (!ATTR_NAME_RE.test(attr)) continue
    let value: string
    if (typeof raw === 'boolean') value = raw ? 'true' : 'false'
    else if (typeof raw === 'number' && Number.isFinite(raw)) value = String(raw)
    else if (typeof raw === 'string') value = raw.trim()
    else continue
    if (value === '') continue
    if (attr === 'colors') {
      value = sparkColors(value)
      if (value === '') continue
    }
    out[`${SPARK_ATTR}${attr}`] = value.slice(0, 20_000)
  }
  return out
}
