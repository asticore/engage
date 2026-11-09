import { ACTIVITY_HIDDEN_ACTIONS, AUDIT_TABLE, PROTECTED_AUDIT_ACTIONS } from './auditLog'

/**
 * The query behind the activity log (/security/activity): everything people do
 * (sign-ins, edits, publishes, setting changes, exports), not only the account
 * security events the older Security audit screen lists. Pure: it builds SQL and
 * bound values, the store runs them. The clear statement lives here too so the
 * rule "consent, privacy and clear records are never removed" is tested in one place.
 */

export const ACTIVITY_PAGE_SIZE = 50
/** Most rows in one CSV export. */
export const ACTIVITY_EXPORT_MAX = 10_000

export type ActivityFilter = {
  action: string | null
  /** Email (substring) or numeric account id. */
  person: string | null
  collection: string | null
  /** YYYY-MM-DD, UTC, inclusive. */
  from: string | null
  to: string | null
  page: number
}

type SearchParams = Record<string, string | string[] | undefined>

const first = (value: string | string[] | undefined): string => {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' ? raw.trim() : ''
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const validDate = (value: string): string | null => (DATE_ONLY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? value : null)

export function parseActivityFilter(search: SearchParams): ActivityFilter {
  const action = first(search.action).slice(0, 64)
  const page = Number.parseInt(first(search.page), 10)
  return {
    action: /^[a-z0-9.-]+$/.test(action) ? action : null,
    person: first(search.person).slice(0, 255) || null,
    collection: first(search.collection).slice(0, 64).replace(/[^a-z0-9_-]/gi, '') || null,
    from: validDate(first(search.from)),
    to: validDate(first(search.to)),
    page: Number.isInteger(page) && page > 0 ? Math.min(page, 100_000) : 1,
  }
}

const likeEscape = (value: string): string => value.replace(/[\\%_]/g, (match) => `\\${match}`)

type Where = { clauses: string[]; binds: unknown[] }

/** The shared WHERE: hidden noise out, then the reader's filters. */
function activityWhere(filter: ActivityFilter): Where {
  const clauses: string[] = [`action NOT IN (${ACTIVITY_HIDDEN_ACTIONS.map(() => '?').join(', ')})`]
  const binds: unknown[] = [...ACTIVITY_HIDDEN_ACTIONS]
  if (filter.action) {
    clauses.push('action = ?')
    binds.push(filter.action)
  }
  if (filter.collection) {
    clauses.push('collection_slug = ?')
    binds.push(filter.collection)
  }
  if (filter.person) {
    if (/^\d+$/.test(filter.person)) {
      clauses.push("(actor_id = ? OR actor_email LIKE ? ESCAPE '\\')")
      binds.push(Number(filter.person), `%${likeEscape(filter.person)}%`)
    } else {
      clauses.push("actor_email LIKE ? ESCAPE '\\'")
      binds.push(`%${likeEscape(filter.person)}%`)
    }
  }
  if (filter.from) {
    clauses.push('created_at >= ?')
    binds.push(`${filter.from}T00:00:00.000Z`)
  }
  if (filter.to) {
    clauses.push('created_at <= ?')
    binds.push(`${filter.to}T23:59:59.999Z`)
  }
  return { clauses, binds }
}

const COLUMNS = 'id, action, actor_id, actor_email, collection_slug, document_id, ip, user_agent, detail, created_at'

/** Newest first. One extra row is fetched so the caller knows whether a next page exists. */
export function buildActivitySelect(filter: ActivityFilter, pageSize = ACTIVITY_PAGE_SIZE): { sql: string; binds: unknown[] } {
  const { clauses, binds } = activityWhere(filter)
  const offset = (Math.max(1, filter.page) - 1) * pageSize
  return {
    sql: `SELECT ${COLUMNS} FROM \`${AUDIT_TABLE}\` WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    binds: [...binds, pageSize + 1, offset],
  }
}

/** The same filters for a CSV download, capped. */
export function buildActivityExport(filter: ActivityFilter): { sql: string; binds: unknown[] } {
  const { clauses, binds } = activityWhere(filter)
  return {
    sql: `SELECT ${COLUMNS} FROM \`${AUDIT_TABLE}\` WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC, id DESC LIMIT ?`,
    binds: [...binds, ACTIVITY_EXPORT_MAX],
  }
}

/** Distinct collection names for the filter dropdown. */
export const ACTIVITY_COLLECTIONS_SQL = `SELECT DISTINCT collection_slug AS slug FROM \`${AUDIT_TABLE}\` WHERE collection_slug IS NOT NULL ORDER BY collection_slug LIMIT 200`

export type ClearScope =
  | { mode: 'all' }
  | { mode: 'older'; days: number }
  | { mode: 'person'; person: string }

export const CLEAR_CONFIRM_WORD = 'CLEAR'

/** What the request asked to clear, or null when the body is not a valid scope. */
export function parseClearScope(body: unknown): ClearScope | null {
  if (!body || typeof body !== 'object') return null
  const raw = body as Record<string, unknown>
  if (raw.mode === 'all') return { mode: 'all' }
  if (raw.mode === 'older') {
    const days = Number(raw.days)
    return Number.isInteger(days) && days >= 1 && days <= 3650 ? { mode: 'older', days } : null
  }
  if (raw.mode === 'person') {
    const person = typeof raw.person === 'string' ? raw.person.trim().slice(0, 255) : ''
    return person ? { mode: 'person', person } : null
  }
  return null
}

const protectedClause = `action NOT IN (${PROTECTED_AUDIT_ACTIONS.map(() => '?').join(', ')})`

/** A short description of a scope, for the clear record and the screen. */
export function describeScope(scope: ClearScope): string {
  if (scope.mode === 'all') return 'all entries'
  if (scope.mode === 'older') return `entries older than ${scope.days} days`
  return `entries for ${scope.person}`
}

function scopeWhere(scope: ClearScope, now: Date): Where {
  const clauses = [protectedClause]
  const binds: unknown[] = [...PROTECTED_AUDIT_ACTIONS]
  if (scope.mode === 'older') {
    clauses.push('created_at < ?')
    binds.push(new Date(now.getTime() - scope.days * 86_400_000).toISOString())
  } else if (scope.mode === 'person') {
    if (/^\d+$/.test(scope.person)) {
      clauses.push('actor_id = ?')
      binds.push(Number(scope.person))
    } else {
      clauses.push('actor_email = ? COLLATE NOCASE')
      binds.push(scope.person)
    }
  }
  return { clauses, binds }
}

export function buildClearCount(scope: ClearScope, now = new Date()): { sql: string; binds: unknown[] } {
  const { clauses, binds } = scopeWhere(scope, now)
  return { sql: `SELECT COUNT(*) AS n FROM \`${AUDIT_TABLE}\` WHERE ${clauses.join(' AND ')}`, binds }
}

export function buildClearDelete(scope: ClearScope, now = new Date()): { sql: string; binds: unknown[] } {
  const { clauses, binds } = scopeWhere(scope, now)
  return { sql: `DELETE FROM \`${AUDIT_TABLE}\` WHERE ${clauses.join(' AND ')}`, binds }
}

const csvCell = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value)
  // A leading = + - @ would run as a formula when the file is opened in a spreadsheet.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function activityRowsToCsv(rows: Array<Record<string, unknown>>): string {
  const head = ['id', 'when_utc', 'event', 'actor_id', 'actor_email', 'collection', 'item', 'detail', 'ip', 'browser']
  const lines = rows.map((r) => [r.id, r.created_at, r.action, r.actor_id, r.actor_email, r.collection_slug, r.document_id, r.detail, r.ip, r.user_agent].map(csvCell).join(','))
  return `${[head.join(','), ...lines].join('\n')}\n`
}

export function activityPageHref(filter: ActivityFilter, page: number): string {
  const params = new URLSearchParams()
  if (filter.action) params.set('action', filter.action)
  if (filter.person) params.set('person', filter.person)
  if (filter.collection) params.set('collection', filter.collection)
  if (filter.from) params.set('from', filter.from)
  if (filter.to) params.set('to', filter.to)
  if (page > 1) params.set('page', String(page))
  const query = params.toString()
  return query ? `?${query}` : '?'
}
