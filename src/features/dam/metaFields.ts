/** Digital asset manager: admin-defined metadata fields and their values. Pure helpers. */

export const FIELD_TYPES = ['text', 'select', 'date', 'number', 'link'] as const
export type FieldType = (typeof FIELD_TYPES)[number]
export const APPLIES_TO = ['all', 'image', 'video', 'audio', 'document'] as const

export type MetaField = {
  id: number
  label: string
  key: string
  type: FieldType
  options: string[]
  required: boolean
  searchable: boolean
  appliesTo: (typeof APPLIES_TO)[number]
  sortOrder: number
}

export type MetaFieldInput = Omit<MetaField, 'id'>

const KEY = /^[a-z][a-z0-9_]{0,39}$/
const slug = (label: string): string => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)

export function parseMetaField(input: Record<string, unknown>, existing: MetaField[], selfId: number | null): { ok: true; value: MetaFieldInput } | { ok: false; error: string } {
  const label = String(input.label ?? '').replace(/\s+/g, ' ').trim()
  if (!label) return { ok: false, error: 'Give the field a label.' }
  if (label.length > 60) return { ok: false, error: 'Labels can be up to 60 characters.' }
  const key = String(input.key ?? '').trim() || slug(label)
  if (!KEY.test(key)) return { ok: false, error: 'The key must start with a letter and use only lowercase letters, numbers and underscores.' }
  if (existing.some((f) => f.id !== selfId && f.key === key)) return { ok: false, error: 'There is already a field with that key.' }
  const type = String(input.type ?? 'text') as FieldType
  if (!FIELD_TYPES.includes(type)) return { ok: false, error: 'Choose a field type: text, select, date, number or link.' }
  const appliesTo = String(input.appliesTo ?? 'all') as MetaField['appliesTo']
  if (!APPLIES_TO.includes(appliesTo)) return { ok: false, error: 'Choose which files the field applies to.' }
  const options = Array.isArray(input.options)
    ? input.options.map((o) => String(o).trim()).filter(Boolean)
    : String(input.options ?? '').split(/[\n,]/).map((o) => o.trim()).filter(Boolean)
  const unique = [...new Set(options)]
  if (type === 'select' && unique.length === 0) return { ok: false, error: 'Add at least one option for a select field.' }
  if (unique.length > 50 || unique.some((o) => o.length > 80)) return { ok: false, error: 'Use up to 50 options of up to 80 characters.' }
  const sortOrder = Number.isInteger(Number(input.sortOrder)) ? Number(input.sortOrder) : 0
  return { ok: true, value: { label, key, type, options: type === 'select' ? unique : [], required: input.required === true, searchable: input.searchable !== false, appliesTo, sortOrder } }
}

/** Which media group a mime type belongs to for `appliesTo`. */
export function mediaGroup(mimeType: string | null | undefined): Exclude<MetaField['appliesTo'], 'all'> {
  const mime = (mimeType ?? '').toLowerCase()
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'document'
}

export const fieldsFor = (fields: MetaField[], mimeType: string | null | undefined): MetaField[] =>
  fields.filter((f) => f.appliesTo === 'all' || f.appliesTo === mediaGroup(mimeType)).sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))

/** Checks and tidies the values for one file. Only fields that apply are kept; blank values are dropped. */
export function validateMetaValues(fields: MetaField[], mimeType: string | null | undefined, input: Record<string, unknown>): { ok: true; value: Record<string, string> } | { ok: false; error: string } {
  const out: Record<string, string> = {}
  for (const f of fieldsFor(fields, mimeType)) {
    const raw = input[f.key]
    const text = raw === undefined || raw === null ? '' : String(raw).trim()
    if (!text) {
      if (f.required) return { ok: false, error: `${f.label} is required.` }
      continue
    }
    if (text.length > 500) return { ok: false, error: `${f.label} is too long (up to 500 characters).` }
    if (f.type === 'number' && !Number.isFinite(Number(text))) return { ok: false, error: `${f.label} must be a number.` }
    if (f.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(text)) return { ok: false, error: `${f.label} must be a date like 2027-03-31.` }
    if (f.type === 'select' && !f.options.includes(text)) return { ok: false, error: `${f.label} must be one of the options.` }
    if (f.type === 'link' && !/^https?:\/\/[^\s]+$/i.test(text)) return { ok: false, error: `${f.label} must be a link starting with http:// or https://.` }
    out[f.key] = text
  }
  return { ok: true, value: out }
}

/** The text stored for search: values of searchable fields, then extra words (caption, tags, camera data). */
export function buildSearchText(fields: MetaField[], values: Record<string, string>, extra: Array<string | null | undefined> = []): string {
  const parts: string[] = []
  for (const f of fields) if (f.searchable && values[f.key]) parts.push(values[f.key])
  for (const e of extra) if (e && e.trim()) parts.push(e.trim())
  return parts.join(' ').replace(/\s+/g, ' ').slice(0, 4_000).toLowerCase()
}

/** Marks where the words read from a PDF or Word document start inside the stored search text, so rebuilding the rest keeps them. */
export const DOC_MARK = ' \u00b6doc\u00b6 '

export const docPart = (searchText: string): string => {
  const at = searchText.indexOf(DOC_MARK)
  return at < 0 ? '' : searchText.slice(at + DOC_MARK.length)
}

/** The details part of a stored search text (everything before the document words). */
export const headPart = (searchText: string): string => {
  const at = searchText.indexOf(DOC_MARK)
  return at < 0 ? searchText : searchText.slice(0, at)
}

export const joinSearchText = (head: string, doc: string): string => (doc.trim() ? `${head.slice(0, 4_000)}${DOC_MARK}${doc.replace(/\s+/g, ' ').trim().slice(0, 20_000).toLowerCase()}` : head.slice(0, 24_000))
