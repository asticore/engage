import { cache } from 'react'

import { getEngine } from '@/lib/engine'
import type { Footer as FooterGlobal, Header as HeaderGlobal, SiteSetting } from '@/engage-types'

/**
 * The globals every public page reads, loaded once per request.
 *
 * The root layout builds the header, footer, theme and brand from these, and
 * buildMetadata reads the site settings again for every page's <head>. Each
 * read is a D1 round trip on Workers, so they are memoised per request with
 * React's cache(): a page render makes one read of each global, whatever
 * number of callers ask for it.
 *
 * This is memory for one request only. A snapshot shared across requests
 * would need its own invalidation; the page edge cache (pageCache.ts) already
 * serves anonymous visitors and is purged on content change.
 */
export type SiteSnapshot = {
  settings: SiteSetting | null
  header: HeaderGlobal | null
  footer: FooterGlobal | null
  shopSettings: Record<string, unknown> | null
}

export const getSiteSnapshot = cache(async (): Promise<SiteSnapshot> => {
  const engine = await getEngine()
  const [settings, header, footer, shopSettings] = await Promise.all([
    engine.findGlobal({ slug: 'site-settings', depth: 1 }).catch((): null => null),
    engine.findGlobal({ slug: 'header', depth: 1 }).catch((): null => null),
    engine.findGlobal({ slug: 'footer', depth: 1 }).catch((): null => null),
    engine.findGlobal({ slug: 'shop-settings', depth: 0 }).catch((): null => null),
  ])
  return {
    settings: settings as SiteSetting | null,
    header: header as HeaderGlobal | null,
    footer: footer as FooterGlobal | null,
    shopSettings: shopSettings as Record<string, unknown> | null,
  }
})
