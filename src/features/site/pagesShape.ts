/**
 * Plain shape of the site-pages global, with defaults applied. Pure, so the admin, the layout and the
 * spec all read the same rules. The loader that reads the database is in ./pages.ts.
 */

/** A launch date and time as stored (ISO text); anything that is not a real date gives null. */
export const parseLaunch = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

/** True when coming soon mode has reached its launch date, so the site opens by itself. */
export const launchReached = (mode: string, launchAt: string | null, now: Date): boolean => mode === 'comingSoon' && launchAt !== null && Date.parse(launchAt) <= now.getTime()

export const DEFAULT_MAINTENANCE_HEADLINE = "We'll be back soon"

export type SitePagesConfig = {
  notFoundPageId: number | null
  privacyPolicyPageId: number | null
  termsPageId: number | null
  maintenance: {
    enabled: boolean
    headline: string
    message: string
    bypassToken: string | null
    allowAdmins: boolean
    /** Maintenance (we'll be back) or coming soon (launch countdown). */
    mode: 'maintenance' | 'comingSoon'
    /** Launch date as an ISO string, or null. Coming soon turns itself off from this moment. */
    launchAt: string | null
  }
}

/** A relationship can arrive as an id, a numeric string, or a populated object. */
export const relationId = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? value : null
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
  if (value && typeof value === 'object' && 'id' in value) return relationId((value as { id?: unknown }).id)
  return null
}

const text = (value: unknown, fallback: string, max: number): string => {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim().slice(0, max)
  return trimmed || fallback
}

const plainText = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '')

export const normaliseSitePages = (raw: unknown): SitePagesConfig => {
  const doc = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const group = doc.maintenance && typeof doc.maintenance === 'object' ? (doc.maintenance as Record<string, unknown>) : {}
  const token = typeof group.bypassToken === 'string' && /^[a-f0-9]{24}$/.test(group.bypassToken) ? group.bypassToken : null

  return {
    notFoundPageId: relationId(doc.notFoundPage),
    privacyPolicyPageId: relationId(doc.privacyPolicyPage),
    termsPageId: relationId(doc.termsPage),
    maintenance: {
      enabled: group.enabled === true,
      headline: text(group.headline, DEFAULT_MAINTENANCE_HEADLINE, 200),
      message: plainText(group.message, 1000),
      bypassToken: token,
      allowAdmins: group.allowAdmins !== false,
      mode: group.mode === 'comingSoon' ? 'comingSoon' : 'maintenance',
      launchAt: parseLaunch(group.launchDate),
    },
  }
}

/** A minimal page entry as the resolver returns it (see utilities/pagePaths). */
export type PathEntry = { page: { id: number | string; isHomepage?: boolean | null }; path: string[] }

/**
 * The public path of a published page, or null when it is not in the list (drafts, trashed or
 * deleted pages). The homepage is "/".
 */
export const pathForPage = (pageId: number | null, entries: readonly PathEntry[]): string | null => {
  if (!pageId) return null
  const entry = entries.find((item) => String(item.page.id) === String(pageId))
  if (!entry) return null
  if (entry.page.isHomepage) return '/'
  return `/${entry.path.join('/')}`
}
