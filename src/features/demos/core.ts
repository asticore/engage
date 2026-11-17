/** Agency demos (Task 22g): the pure rules. No database or engine imports. */

import type { ExportOptions } from '@/features/settingsTransfer/format'

export type ResetEvery = 'off' | 'hourly' | 'daily'
export const RESET_CHOICES: { value: ResetEvery; label: string }[] = [
  { value: 'off', label: 'Never (reset by hand only)' },
  { value: 'hourly', label: 'Every hour' },
  { value: 'daily', label: 'Every day' },
]

/** Largest saved copy. A D1 row holds about 2 MB; the copy stays under it. */
export const MAX_SNAPSHOT_BYTES = 1_500_000
export const MAX_BANNER = 200
export const MAX_DEMO_ACCOUNTS_PER_CALL = 1

export const toResetEvery = (v: unknown): ResetEvery => (v === 'hourly' || v === 'daily' ? v : 'off')

/**
 * What a demo copy holds: settings, header and footer, redirects, page templates, field groups, pages, posts and
 * products. Never users, roles, shop customers or secrets, so a package can be handed to a client safely.
 */
export const DEMO_EXPORT_OPTIONS: ExportOptions = {
  settings: true,
  headerFooter: true,
  roles: false,
  users: false,
  redirects: true,
  pageTemplates: true,
  fieldGroups: true,
  content: { pages: true, posts: true, products: true, mediaMetadata: true, customers: false },
  includeSecrets: false,
}

/** Sections an import of a demo copy writes back. Users and roles are left out on purpose. */
export const DEMO_IMPORT_SECTIONS = ['settings', 'headerFooter', 'redirects', 'pageTemplates', 'fieldGroups', 'pages', 'posts', 'products', 'mediaMetadata'] as const

/** True when a scheduled reset should run now. A reset that never ran is due as soon as a schedule is on. */
export function isResetDue(every: ResetEvery, lastResetAt: string | null | undefined, now: Date): boolean {
  if (every === 'off') return false
  const last = lastResetAt ? Date.parse(lastResetAt) : NaN
  if (!Number.isFinite(last)) return true
  const gap = every === 'hourly' ? 3_600_000 : 86_400_000
  // A few minutes of slack so a tick that lands just before the hour boundary does not skip a whole period.
  return now.getTime() - last >= gap - 300_000
}

export const cleanBanner = (v: unknown): string => (typeof v === 'string' ? v.replace(/[\r\n]+/g, ' ').trim().slice(0, MAX_BANNER) : '')

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const isEmail = (v: unknown): v is string => typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v.trim())

/** A readable one-time password (no look-alike characters). */
export function demoPassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(14)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

export function describeBytes(n: number): string {
  if (n < 1024) return `${n} bytes`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/** Collections a reset cleans up: anything with a slug that is not in the saved copy was added after it and is removed. */
export const RESET_CLEAN_COLLECTIONS = [
  { collection: 'pages', section: 'pages' },
  { collection: 'posts', section: 'posts' },
  { collection: 'products', section: 'products' },
] as const

/** The ids of records that are not in the saved copy (matched by slug). A record with no slug is never touched. */
export function idsAddedAfterCopy(existing: { id: number | string; slug?: unknown }[], keepSlugs: ReadonlySet<string>): (number | string)[] {
  return existing.filter((doc) => typeof doc.slug === 'string' && doc.slug !== '' && !keepSlugs.has(doc.slug)).map((doc) => doc.id)
}

/** Picture files kept for a reset live in the same bucket under this prefix. */
export const COPY_KEY_PREFIX = 'demo-copy/'
export const copyKey = (filename: string): string => `${COPY_KEY_PREFIX}${filename}`
/** Bounds for the kept copies so one demo cannot fill the bucket. */
export const MAX_COPIED_PICTURES = 500
export const MAX_PICTURE_BYTES = 15 * 1024 * 1024

/** Pictures not in the saved copy (matched by file name). */
export function picturesAddedAfterCopy<T extends { filename?: unknown }>(live: T[], keepNames: ReadonlySet<string>): T[] {
  return live.filter((d) => typeof d.filename === 'string' && d.filename !== '' && !keepNames.has(d.filename))
}
