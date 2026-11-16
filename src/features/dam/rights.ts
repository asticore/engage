/** Digital asset manager: status, licence, expiry and embargo. Pure helpers, no database. */

export const STATUSES = ['draft', 'in_review', 'approved', 'archived'] as const
export type AssetStatus = (typeof STATUSES)[number]
export const STATUS_LABELS: Record<AssetStatus, string> = { draft: 'Draft', in_review: 'In review', approved: 'Approved', archived: 'Archived' }

export type Rights = {
  status: AssetStatus
  licenceType: string
  licenceTerms: string
  credit: string
  usageNotes: string
  territory: string
  releaseNote: string
  /** ISO dates (YYYY-MM-DD) or null. */
  licenceStart: string | null
  licenceExpiry: string | null
  embargoUntil: string | null
}

export const EMPTY_RIGHTS: Rights = {
  status: 'approved',
  licenceType: '',
  licenceTerms: '',
  credit: '',
  usageNotes: '',
  territory: '',
  releaseNote: '',
  licenceStart: null,
  licenceExpiry: null,
  embargoUntil: null,
}

const TEXT_LIMITS = { licenceType: 80, licenceTerms: 2000, credit: 200, usageNotes: 2000, territory: 200, releaseNote: 500 } as const

const isIsoDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value

function parseDate(value: unknown, label: string): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === '') return { ok: true, value: null }
  const text = String(value).trim().slice(0, 10)
  if (!isIsoDate(text)) return { ok: false, error: `${label} must be a date like 2027-03-31.` }
  return { ok: true, value: text }
}

/** Validates the rights form. Unknown fields are ignored, long text is refused rather than cut. */
export function parseRights(input: Record<string, unknown>): { ok: true; value: Rights } | { ok: false; error: string } {
  const status = String(input.status ?? 'approved')
  if (!(STATUSES as readonly string[]).includes(status)) return { ok: false, error: 'Choose a status: draft, in review, approved or archived.' }
  const out: Rights = { ...EMPTY_RIGHTS, status: status as AssetStatus }
  for (const key of Object.keys(TEXT_LIMITS) as Array<keyof typeof TEXT_LIMITS>) {
    const text = String(input[key] ?? '').replace(/\r\n/g, '\n').trim()
    if (text.length > TEXT_LIMITS[key]) return { ok: false, error: `That text is too long (up to ${TEXT_LIMITS[key]} characters).` }
    out[key] = text
  }
  const start = parseDate(input.licenceStart, 'Licence start')
  if (start.ok === false) return start
  const expiry = parseDate(input.licenceExpiry, 'Licence expiry')
  if (expiry.ok === false) return expiry
  const embargo = parseDate(input.embargoUntil, 'Embargo date')
  if (embargo.ok === false) return embargo
  if (start.value && expiry.value && expiry.value < start.value) return { ok: false, error: 'The licence cannot expire before it starts.' }
  out.licenceStart = start.value
  out.licenceExpiry = expiry.value
  out.embargoUntil = embargo.value
  return { ok: true, value: out }
}

export type RightsState = 'ok' | 'expiring' | 'expired' | 'embargoed' | 'not_started' | 'not_approved' | 'archived'

export type RightsCheck = {
  state: RightsState
  /** False when the file must not be picked for new content or served as published. */
  usable: boolean
  /** Plain-language reason, empty when nothing is wrong. */
  reason: string
  /** Whole days to the expiry date (negative once past), null when there is no expiry. */
  daysToExpiry: number | null
}

const DAY_MS = 86_400_000

/** What the rights say about using a file on `now`. Dates are whole days: a licence valid until the 31st is usable all day on the 31st. */
export function checkRights(rights: Rights, now: Date, options: { warnDays?: number; requireApproval?: boolean } = {}): RightsCheck {
  const today = now.toISOString().slice(0, 10)
  const days = rights.licenceExpiry ? Math.round((Date.parse(`${rights.licenceExpiry}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS) : null
  const base = { daysToExpiry: days }
  if (rights.status === 'archived') return { ...base, state: 'archived', usable: false, reason: 'This file is archived.' }
  if (rights.licenceExpiry && rights.licenceExpiry < today) return { ...base, state: 'expired', usable: false, reason: `The licence expired on ${rights.licenceExpiry}.` }
  if (rights.embargoUntil && rights.embargoUntil > today) return { ...base, state: 'embargoed', usable: false, reason: `Embargoed until ${rights.embargoUntil}.` }
  if (rights.licenceStart && rights.licenceStart > today) return { ...base, state: 'not_started', usable: false, reason: `The licence starts on ${rights.licenceStart}.` }
  if (options.requireApproval && rights.status !== 'approved') return { ...base, state: 'not_approved', usable: false, reason: `This file is ${STATUS_LABELS[rights.status].toLowerCase()}, not approved.` }
  const warn = options.warnDays ?? 30
  if (days !== null && days <= warn) return { ...base, state: 'expiring', usable: true, reason: days === 0 ? 'The licence expires today.' : `The licence expires in ${days} day${days === 1 ? '' : 's'}.` }
  return { ...base, state: 'ok', usable: true, reason: '' }
}

/** Allowed status moves. Anyone with media access can send a file for review; approving needs `canApprove`. */
export function canMoveStatus(from: AssetStatus, to: AssetStatus, canApprove: boolean): { ok: true } | { ok: false; error: string } {
  if (from === to) return { ok: true }
  if (to === 'approved' && !canApprove) return { ok: false, error: 'Only an admin can approve a file.' }
  if (from === 'approved' && to === 'draft' && !canApprove) return { ok: false, error: 'Only an admin can take an approved file back to draft.' }
  return { ok: true }
}
