/**
 * Server revisions (Payload versions) for the History panel's Revisions tab. Pure helpers: the URL to ask,
 * how to read the answer, and how to say "5 minutes ago". The fetching lives in useRevisions.ts.
 */
export type RevisionRow = {
  id: string
  updatedAt: string
  /** `draft` / `published`, or null when the collection has no draft status. */
  status: string | null
  /** The user id (or null) that saved this revision; resolved to a name by the panel. */
  authorId: number | string | null
  latest: boolean
  /** The revision's own value of the surface's blocks field, as stored. */
  blocks: unknown
}

/** Versions endpoint for a collection document or a global. Same query VersionsList uses. */
export function revisionsUrl(kind: 'collection' | 'global', slug: string, id: string | undefined): string | null {
  const tail = 'limit=50&sort=-updatedAt&depth=0'
  if (kind === 'global') return `/api/globals/${slug}/versions?${tail}`
  if (!id) return null
  return `/api/${slug}/versions?where[parent][equals]=${encodeURIComponent(id)}&${tail}`
}

/** Reads a versions response. Anything that is not a list of versions gives an empty list. */
export function parseRevisions(body: unknown, blocksField: string): RevisionRow[] {
  const docs = (body as { docs?: unknown } | null)?.docs
  if (!Array.isArray(docs)) return []
  const rows: RevisionRow[] = []
  for (const entry of docs) {
    if (!entry || typeof entry !== 'object') continue
    const doc = entry as { id?: unknown; updatedAt?: unknown; latest?: unknown; version?: Record<string, unknown> }
    const version = doc.version && typeof doc.version === 'object' ? doc.version : {}
    const updatedAt = typeof doc.updatedAt === 'string' ? doc.updatedAt : typeof version.updatedAt === 'string' ? version.updatedAt : ''
    const author = version.updatedBy
    const authorValue = author && typeof author === 'object' ? (author as { id?: unknown }).id : author
    rows.push({
      id: String(doc.id ?? rows.length),
      updatedAt,
      status: typeof version._status === 'string' ? version._status : null,
      authorId: typeof authorValue === 'number' || typeof authorValue === 'string' ? authorValue : null,
      latest: doc.latest === true,
      blocks: version[blocksField],
    })
  }
  return rows
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

/** "5 minutes ago" in the viewer's language. `now` is passed in so the result is stable. */
export function relativeTime(iso: string, now: number, locale?: string): string {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return iso
  const seconds = Math.round((then - now) / 1000)
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit)
  }
  return formatter.format(0, 'second')
}
