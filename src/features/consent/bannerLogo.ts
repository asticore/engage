/**
 * The cookie banner's logo when it is a picture from the media library. The
 * Integrations global keeps the picked media item (`consent.logo`, an id at depth
 * 0); this looks its address up and gives the banner the same path-only logo the
 * path field gives. A picture whose address is not a path on this site is not used,
 * as before. Never throws: without a picture the settings are returned unchanged.
 */

import { cleanLogoUrl, type ConsentConfig } from './config'

export async function resolveBannerLogo(consent: ConsentConfig, integrations: Record<string, unknown> | null): Promise<ConsentConfig> {
  try {
    const group = integrations?.consent && typeof integrations.consent === 'object' ? (integrations.consent as Record<string, unknown>) : null
    if (!group || group.showLogo !== true) return consent
    const raw = group.logo
    const id = typeof raw === 'number' ? raw : raw && typeof raw === 'object' && typeof (raw as { id?: unknown }).id === 'number' ? (raw as { id: number }).id : null
    if (id === null) return consent
    const { getEngine } = await import('@/lib/engine')
    const engine = await getEngine()
    const found = await engine.find({ collection: 'media', where: { id: { equals: id } }, limit: 1, depth: 0, overrideAccess: true })
    const url = (found.docs[0] as { url?: unknown } | undefined)?.url
    const path = typeof url === 'string' ? cleanLogoUrl(url) : null
    return path ? { ...consent, logoUrl: path } : consent
  } catch {
    return consent
  }
}
