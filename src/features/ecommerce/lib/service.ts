/**
 * Service products: a simple or variable product that is sold without shipping and can state how long it takes.
 * It keeps every simple and variable product feature (price, options, tiers, add-ons, subscriptions). Pure.
 */
export type ServiceFields = { isService?: boolean | null; isVirtual?: boolean | null; virtual?: boolean | null; serviceDuration?: number | null }

export const isService = (p: ServiceFields | null | undefined): boolean => p?.isService === true

/** True when nothing is shipped for this product: a service, or a product marked as virtual. */
export const isNonShipping = (p: ServiceFields | null | undefined): boolean => isService(p) || p?.isVirtual === true || p?.virtual === true

/** "1 hour 30 minutes" from minutes, or '' when there is no usable duration. */
export function durationText(minutes: unknown): string {
  const n = typeof minutes === 'number' && Number.isFinite(minutes) ? Math.round(minutes) : 0
  if (n <= 0) return ''
  const h = Math.floor(n / 60)
  const m = n % 60
  const parts: string[] = []
  if (h > 0) parts.push(`${h} ${h === 1 ? 'hour' : 'hours'}`)
  if (m > 0) parts.push(`${m} ${m === 1 ? 'minute' : 'minutes'}`)
  return parts.join(' ')
}

/** The extra detail row shown on a service's product page, or null. */
export function serviceDetail(p: ServiceFields | null | undefined): { name: string; values: string[] } | null {
  if (!isService(p)) return null
  const text = durationText(p?.serviceDuration)
  return text ? { name: 'Duration', values: [text] } : null
}
