/** Digital asset manager: advanced media search. Pure: turns filters into SQL, nothing here touches the database. */

export const SORTS = ['newest', 'oldest', 'name', 'size'] as const
export const TYPES = ['image', 'video', 'audio', 'document'] as const
export const LICENCE_STATES = ['expired', 'expiring', 'embargoed', 'flagged'] as const
export const STATUS_VALUES = ['draft', 'in_review', 'approved', 'archived'] as const

export type SearchFilters = {
  q: string
  type: '' | (typeof TYPES)[number]
  folder: string
  tagId: number
  collectionId: number
  sizeMinKb: number
  sizeMaxKb: number
  from: string
  to: string
  minWidth: number
  minHeight: number
  orientation: '' | 'landscape' | 'portrait' | 'square'
  status: '' | (typeof STATUS_VALUES)[number]
  licence: '' | (typeof LICENCE_STATES)[number]
  meta: Record<string, string>
  sort: (typeof SORTS)[number]
}

export const EMPTY_FILTERS: SearchFilters = { q: '', type: '', folder: '', tagId: 0, collectionId: 0, sizeMinKb: 0, sizeMaxKb: 0, from: '', to: '', minWidth: 0, minHeight: 0, orientation: '', status: '', licence: '', meta: {}, sort: 'newest' }

const num = (v: unknown, max = 1_000_000_000): number => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : 0
}
const date = (v: unknown): string => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '')
const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | '' => (typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : '')

/** Cleans filters from anywhere (a query string, saved JSON): unknown or malformed values fall back to "no filter". */
export function parseFilters(input: Record<string, unknown>): SearchFilters {
  const meta: Record<string, string> = {}
  const rawMeta = input.meta && typeof input.meta === 'object' && !Array.isArray(input.meta) ? (input.meta as Record<string, unknown>) : {}
  for (const [key, value] of Object.entries(rawMeta)) {
    if (/^[a-z][a-z0-9_]{0,39}$/.test(key) && typeof value === 'string' && value.trim() && value.length <= 200) meta[key] = value.trim()
    if (Object.keys(meta).length >= 10) break
  }
  const orientation = pick(input.orientation, ['landscape', 'portrait', 'square'] as const)
  return {
    q: typeof input.q === 'string' ? input.q.trim().slice(0, 200) : '',
    type: pick(input.type, TYPES),
    folder: typeof input.folder === 'string' ? input.folder.trim().replace(/^\/+|\/+$/g, '').slice(0, 120) : '',
    tagId: num(input.tagId, 1_000_000),
    collectionId: num(input.collectionId, 1_000_000),
    sizeMinKb: num(input.sizeMinKb),
    sizeMaxKb: num(input.sizeMaxKb),
    from: date(input.from),
    to: date(input.to),
    minWidth: num(input.minWidth, 100_000),
    minHeight: num(input.minHeight, 100_000),
    orientation,
    status: pick(input.status, STATUS_VALUES),
    licence: pick(input.licence, LICENCE_STATES),
    meta,
    sort: pick(input.sort, SORTS) || 'newest',
  }
}

/** Filters from a URL's query string (`meta.key=value` for custom fields). */
export function filtersFromParams(params: URLSearchParams): SearchFilters {
  const raw: Record<string, unknown> = {}
  const meta: Record<string, string> = {}
  for (const [key, value] of params) {
    if (key.startsWith('meta.')) meta[key.slice(5)] = value
    else raw[key] = value
  }
  raw.meta = meta
  return parseFilters(raw)
}

/** True when no filter is set. */
export const isEmpty = (f: SearchFilters): boolean => JSON.stringify({ ...f, sort: 'newest' }) === JSON.stringify({ ...EMPTY_FILTERS })

const likeEscape = (s: string): string => s.replace(/[\\%_]/g, (c) => `\\${c}`)

export type SearchContext = {
  todayIso: string
  /** Licence expiry warning window end (today plus warn days), YYYY-MM-DD. */
  warnUntilIso: string
  /** The chosen tag and every sub-tag, when the tag filter is used and the tags feature is on. */
  tagIds?: number[]
  /** For a smart collection: ids already resolved are not used; membership comes from the filters themselves. */
  withTags?: boolean
}

export type SearchQuery = { sql: string; countSql: string; args: unknown[] }

const SELECT = 'm.id AS id, m.filename AS filename, m.url AS url, m.alt AS alt, m.mime_type AS mime_type, m.filesize AS filesize, m.width AS width, m.height AS height, m.folder AS folder, m.created_at AS created_at, COALESCE(a.status, \'approved\') AS status, a.licence_expiry AS licence_expiry'

/** Builds the search. `page` is 1-based. Every value goes in as a bound parameter, never into the SQL text. */
export function buildSearch(f: SearchFilters, ctx: SearchContext, page: number, pageSize: number): SearchQuery {
  const where: string[] = []
  const args: unknown[] = []
  const bind = (value: unknown): string => {
    args.push(value)
    return `?${args.length}`
  }
  for (const word of f.q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8)) {
    const p = bind(`%${likeEscape(word)}%`)
    where.push(`(LOWER(COALESCE(m.filename,'')) LIKE ${p} ESCAPE '\\' OR LOWER(COALESCE(m.alt,'')) LIKE ${p} ESCAPE '\\' OR LOWER(COALESCE(m.caption,'')) LIKE ${p} ESCAPE '\\' OR LOWER(COALESCE(m.credit,'')) LIKE ${p} ESCAPE '\\' OR LOWER(COALESCE(m.folder,'')) LIKE ${p} ESCAPE '\\' OR COALESCE(a.search_text,'') LIKE ${p} ESCAPE '\\')`)
  }
  if (f.type) {
    if (f.type === 'document') where.push(`(m.mime_type IS NULL OR (m.mime_type NOT LIKE 'image/%' AND m.mime_type NOT LIKE 'video/%' AND m.mime_type NOT LIKE 'audio/%'))`)
    else where.push(`m.mime_type LIKE ${bind(`${f.type}/%`)}`)
  }
  if (f.folder) where.push(`(m.folder = ${bind(f.folder)} OR m.folder LIKE ${bind(`${likeEscape(f.folder)}/%`)} ESCAPE '\\')`)
  if (f.collectionId) where.push(`m.id IN (SELECT media_id FROM eg_media_collection_items WHERE collection_id = ${bind(f.collectionId)})`)
  if (f.tagId && ctx.tagIds && ctx.tagIds.length > 0) where.push(`m.id IN (SELECT media_id FROM eg_media_tag_links WHERE tag_id IN (${ctx.tagIds.map((id) => bind(id)).join(',')}))`)
  if (f.sizeMinKb) where.push(`m.filesize >= ${bind(f.sizeMinKb * 1024)}`)
  if (f.sizeMaxKb) where.push(`m.filesize <= ${bind(f.sizeMaxKb * 1024)}`)
  if (f.from) where.push(`m.created_at >= ${bind(`${f.from}T00:00:00`)}`)
  if (f.to) where.push(`m.created_at < ${bind(`${f.to}T23:59:59.999Z`)}`)
  if (f.minWidth) where.push(`m.width >= ${bind(f.minWidth)}`)
  if (f.minHeight) where.push(`m.height >= ${bind(f.minHeight)}`)
  if (f.orientation === 'landscape') where.push('m.width > m.height')
  if (f.orientation === 'portrait') where.push('m.height > m.width')
  if (f.orientation === 'square') where.push('m.width = m.height AND m.width IS NOT NULL')
  if (f.status) where.push(`COALESCE(a.status, 'approved') = ${bind(f.status)}`)
  if (f.licence) {
    const today = bind(ctx.todayIso)
    if (f.licence === 'expired') where.push(`a.licence_expiry IS NOT NULL AND a.licence_expiry < ${today}`)
    else if (f.licence === 'expiring') where.push(`a.licence_expiry IS NOT NULL AND a.licence_expiry >= ${today} AND a.licence_expiry <= ${bind(ctx.warnUntilIso)}`)
    else if (f.licence === 'embargoed') where.push(`a.embargo_until IS NOT NULL AND a.embargo_until > ${today}`)
    else where.push(`(a.status = 'archived' OR (a.licence_expiry IS NOT NULL AND a.licence_expiry < ${today}) OR (a.embargo_until IS NOT NULL AND a.embargo_until > ${today}) OR (a.licence_start IS NOT NULL AND a.licence_start > ${today}))`)
  }
  for (const [key, value] of Object.entries(f.meta)) where.push(`COALESCE(a.meta_json,'') LIKE ${bind(`%${likeEscape(JSON.stringify(key))}:${likeEscape(JSON.stringify(value))}%`)} ESCAPE '\\'`)
  const order = { newest: 'm.created_at DESC, m.id DESC', oldest: 'm.created_at ASC, m.id ASC', name: 'LOWER(COALESCE(m.filename,\'\')) ASC, m.id ASC', size: 'COALESCE(m.filesize,0) DESC, m.id DESC' }[f.sort]
  const from = 'FROM eg_media m LEFT JOIN eg_media_assets a ON a.media_id = m.id'
  const clause = where.length > 0 ? ` WHERE ${where.join(' AND ')}` : ''
  const limit = Math.max(1, Math.min(pageSize, 200))
  const offset = Math.max(0, (Math.max(1, page) - 1) * limit)
  return {
    sql: `SELECT ${SELECT} ${from}${clause} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`,
    countSql: `SELECT COUNT(*) AS n ${from}${clause}`,
    args,
  }
}
