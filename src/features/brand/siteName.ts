/**
 * The site's name, from Site Settings. The code never hard-codes a brand: a fresh install starts with the
 * neutral default below, and every place that shows the name reads it from the site settings (the per-request
 * snapshot, see features/speed/siteSnapshot.ts) and falls back to this constant only when nothing is saved.
 */
export const DEFAULT_SITE_NAME = 'My website'

/** The site name to show: the saved Site Settings name, trimmed, or the neutral default when it is blank or missing. */
export function siteNameOf(settings: { siteName?: string | null } | null | undefined): string {
  return settings?.siteName?.trim() || DEFAULT_SITE_NAME
}
