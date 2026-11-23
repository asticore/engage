/**
 * Parameters of a reusable section (Task 13 / 32c). Pure helpers, no database.
 *
 * A reusable section can hold one "Section inputs" element (`section-params`) that declares up to 12 parameters:
 * text, link, image, colour, number or choice. The section's own content uses `{{param:key}}` wherever a value
 * should go. Each place the section is used (a "Reusable section with inputs" element, `section-instance`) stores
 * only the values it overrides; every other parameter follows the default declared in the source. The source's
 * blocks are read live on every render, so a layout change in the source reaches every instance.
 */

export const PARAM_TYPES = ['text', 'link', 'image', 'colour', 'number', 'choice'] as const
export type ParamType = (typeof PARAM_TYPES)[number]

export type ParamDecl = {
  key: string
  label: string
  type: ParamType
  /** The default as typed in the declaration. Text, link, colour and choice stay strings; number and image are parsed on use. */
  default?: string
  /** Choice only. */
  choices?: string[]
}

export type ParamValue = string | number
export type ParamValues = Record<string, ParamValue>

export const PARAMS_ELEMENT = 'section-params'
export const INSTANCE_ELEMENT = 'section-instance'
export const MAX_PARAMS = 12

const KEY_RE = /^[a-z][a-z0-9_]{0,31}$/
const TOKEN_RE = /\{\{\s*param:([a-z][a-z0-9_]{0,31})\s*\}\}/g
const WHOLE_TOKEN_RE = /^\{\{\s*param:([a-z][a-z0-9_]{0,31})\s*\}\}$/
const COLOUR_RE = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,24}|(rgb|rgba|hsl|hsla)\([0-9a-zA-Z .,%/-]{3,48}\)|var\(--[a-zA-Z0-9-]{1,40}\))$/

const isRec = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

/** Reads the declaration rows of a `section-params` element. Rows with a bad or repeated key are dropped. */
export function parseParamDecls(raw: unknown): ParamDecl[] {
  if (!Array.isArray(raw)) return []
  const out: ParamDecl[] = []
  const seen = new Set<string>()
  for (const row of raw) {
    if (!isRec(row)) continue
    const key = typeof row.key === 'string' ? row.key.trim() : ''
    if (!KEY_RE.test(key) || seen.has(key)) continue
    const type = (PARAM_TYPES as readonly string[]).includes(String(row.type)) ? (row.type as ParamType) : 'text'
    const decl: ParamDecl = { key, label: typeof row.label === 'string' && row.label.trim() ? row.label.trim().slice(0, 60) : key, type }
    if (typeof row.default === 'string' && row.default !== '') decl.default = row.default.slice(0, 500)
    if (type === 'choice') {
      const list = Array.isArray(row.choices) ? row.choices : typeof row.choices === 'string' ? row.choices.split(',') : []
      const choices = list.map((c) => String(c).trim()).filter(Boolean).slice(0, 24)
      decl.choices = choices
      if (decl.default !== undefined && !choices.includes(decl.default)) delete decl.default
    }
    seen.add(key)
    out.push(decl)
    if (out.length >= MAX_PARAMS) break
  }
  return out
}

/** The declarations in a block list: the first `section-params` element, at any depth of section columns. */
export function findParamDecls(blocks: unknown): ParamDecl[] {
  const visit = (list: unknown, depth: number): ParamDecl[] | null => {
    if (!Array.isArray(list) || depth > 8) return null
    for (const node of list) {
      if (!isRec(node)) continue
      if (node.blockType === 'element' && node.elementType === PARAMS_ELEMENT) return parseParamDecls(isRec(node.props) ? node.props.params : undefined)
      if (node.blockType === 'section' && Array.isArray(node.columns)) {
        for (const column of node.columns) {
          const found = isRec(column) ? visit(column.blocks, depth + 1) : null
          if (found) return found
        }
      }
    }
    return null
  }
  return visit(blocks, 0) ?? []
}

/** A value checked against its declaration. Undefined when it does not fit (the default is used instead). */
export function coerceParamValue(decl: ParamDecl, value: unknown): ParamValue | undefined {
  switch (decl.type) {
    case 'number': {
      const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
      return Number.isFinite(n) ? n : undefined
    }
    case 'image': {
      if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value
      if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim())
      return undefined
    }
    case 'colour':
      return typeof value === 'string' && COLOUR_RE.test(value.trim()) ? value.trim() : undefined
    case 'link': {
      if (typeof value !== 'string') return undefined
      const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, '').trim()
      if (cleaned === '') return undefined
      if (cleaned.startsWith('#') || /^(https?:\/\/|mailto:|tel:)/i.test(cleaned)) return cleaned.slice(0, 500)
      return cleaned.startsWith('/') && !cleaned.startsWith('//') && !cleaned.startsWith('/\\') ? cleaned.slice(0, 500) : undefined
    }
    case 'choice':
      return typeof value === 'string' && (decl.choices ?? []).includes(value) ? value : undefined
    default:
      return typeof value === 'string' ? value.slice(0, 2000) : typeof value === 'number' ? String(value) : undefined
  }
}

/** The value of every declared parameter: what the instance overrides, else the declared default, else empty text. */
export function resolveParamValues(decls: ParamDecl[], overrides: unknown): ParamValues {
  const given = isRec(overrides) ? overrides : {}
  const out: ParamValues = {}
  for (const decl of decls) {
    const own = Object.prototype.hasOwnProperty.call(given, decl.key) ? coerceParamValue(decl, given[decl.key]) : undefined
    const fallback = decl.default !== undefined ? coerceParamValue(decl, decl.default) : undefined
    out[decl.key] = own ?? fallback ?? (decl.type === 'number' || decl.type === 'image' ? '' : '')
  }
  return out
}

/** Which of the instance's stored values are real overrides (declared, valid and different from the default). */
export function overriddenKeys(decls: ParamDecl[], overrides: unknown): string[] {
  const given = isRec(overrides) ? overrides : {}
  return decls.filter((d) => Object.prototype.hasOwnProperty.call(given, d.key) && coerceParamValue(d, given[d.key]) !== undefined).map((d) => d.key)
}

/**
 * A copy of `value` with every `{{param:key}}` replaced. A string that is only one token becomes the typed value
 * (a number stays a number, so an image id still works as an image prop); a token inside longer text becomes text.
 * Tokens of an undeclared key become empty. Other merge tags are left alone. The input is not changed.
 */
export function applyParams<T>(value: T, values: ParamValues): T {
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') {
      if (!node.includes('{{')) return node
      const whole = WHOLE_TOKEN_RE.exec(node)
      if (whole) return Object.prototype.hasOwnProperty.call(values, whole[1]) ? values[whole[1]] : ''
      return node.replace(TOKEN_RE, (_m, key: string) => (Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : ''))
    }
    if (Array.isArray(node)) return node.map(walk)
    if (isRec(node)) {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(node)) out[k] = walk(v)
      return out
    }
    return node
  }
  return walk(value) as T
}

export type ParamRow = { key: string; label?: string; type: ParamType; /** The text or value to turn into this parameter. */ find?: string; choices?: string }

/**
 * Turns the content of a section into a parametric one: each row's `find` text (or number, or colour) is replaced by
 * its token wherever it occurs as a whole string value, and the row becomes a declaration whose default is that text.
 * Returns the new blocks, the declarations and how many places each row replaced.
 */
export function makeParametric<T>(blocks: T, rows: ParamRow[]): { blocks: T; decls: ParamDecl[]; replaced: Record<string, number> } {
  const decls = parseParamDecls(rows.map((r) => ({ key: r.key, label: r.label, type: r.type, default: r.find, choices: r.choices })))
  const finds = new Map<string, string>()
  for (const row of rows) {
    const find = row.find?.trim()
    if (find && decls.some((d) => d.key === row.key.trim())) finds.set(find, row.key.trim())
  }
  const replaced: Record<string, number> = {}
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') {
      const key = finds.get(node.trim())
      if (key) {
        replaced[key] = (replaced[key] ?? 0) + 1
        return `{{param:${key}}}`
      }
      return node
    }
    if (typeof node === 'number') {
      const key = finds.get(String(node))
      if (key) {
        replaced[key] = (replaced[key] ?? 0) + 1
        return `{{param:${key}}}`
      }
      return node
    }
    if (Array.isArray(node)) return node.map(walk)
    if (isRec(node)) {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(node)) out[k] = k === 'blockType' || k === 'elementType' || k === '_id' ? v : walk(v)
      return out
    }
    return node
  }
  return { blocks: walk(blocks) as T, decls, replaced }
}
