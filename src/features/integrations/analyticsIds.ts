/**
 * Format check for the tracking IDs on the Integrations page. Pure and offline:
 * nothing is sent to Google, Microsoft, Meta or TikTok, so it is safe to run on
 * any draft. Blank means "not used" and is never a problem.
 *
 * A wrong shape is the common mistake (a GA4 ID pasted as a UA-number, a GTM
 * ID with the wrong prefix), and the tag then silently never loads.
 */

export type AnalyticsIdValues = {
  ga4MeasurementId?: unknown
  gtmContainerId?: unknown
  clarityProjectId?: unknown
  metaPixelId?: unknown
  tiktokPixelId?: unknown
}

export type AnalyticsIdProblem = { field: keyof AnalyticsIdValues; label: string; message: string }

const RULES: Array<{ field: keyof AnalyticsIdValues; label: string; pattern: RegExp; example: string }> = [
  { field: 'ga4MeasurementId', label: 'GA4 measurement ID', pattern: /^G-[A-Z0-9]{4,}$/i, example: 'G-XXXXXXXXXX' },
  { field: 'gtmContainerId', label: 'Tag Manager container ID', pattern: /^GTM-[A-Z0-9]{4,}$/i, example: 'GTM-XXXXXXX' },
  { field: 'clarityProjectId', label: 'Clarity project ID', pattern: /^[a-z0-9]{6,20}$/i, example: 'abcd1234ef' },
  { field: 'metaPixelId', label: 'Meta Pixel ID', pattern: /^\d{10,20}$/, example: 'a string of digits, such as 1234567890123456' },
  { field: 'tiktokPixelId', label: 'TikTok Pixel ID', pattern: /^[A-Z0-9]{10,}$/i, example: 'a code of letters and digits from TikTok Events Manager' },
]

/** Returns one problem per ID that is filled in and does not look right. Empty list means every filled ID looks right. */
export function analyticsIdProblems(values: AnalyticsIdValues): AnalyticsIdProblem[] {
  const problems: AnalyticsIdProblem[] = []
  for (const rule of RULES) {
    const raw = values[rule.field]
    const text = typeof raw === 'string' ? raw.trim() : ''
    if (!text) continue
    if (!rule.pattern.test(text)) {
      problems.push({ field: rule.field, label: rule.label, message: `${rule.label} "${text}" does not look right. It should look like ${rule.example}.` })
    }
  }
  return problems
}
