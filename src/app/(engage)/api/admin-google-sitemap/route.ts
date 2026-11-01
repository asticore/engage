import { NextRequest, NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { adminRequestRefusal } from '@/features/forms/origin'
import { searchSiteOrNull } from '@/features/google/dashboard/connection'
import { sitemapFeedFor, submitSitemap } from '@/features/google/sitemaps'
import { configuredSiteOrigin } from '@/utilities/siteOrigin'
import { getEngine } from '@/lib/engine'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

/**
 * POST { site }: asks Google to read this site's sitemap (SITE_URL + /sitemap.xml). Admins only.
 * The sitemap address is built here, never taken from the request; the property comes from the
 * Search Console card.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const refusal = adminRequestRefusal(request)
    if (refusal) return NextResponse.json({ ok: false, error: refusal }, { status: 403, headers: NO_STORE })

    const context = await getAdminContext()
    if (!context.user || !context.isAdmin) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403, headers: NO_STORE })

    const body = (await request.json().catch((): null => null)) as { site?: unknown } | null
    const site = searchSiteOrNull(body?.site)
    if (!site) return NextResponse.json({ ok: false, error: 'Choose a Search Console property first.' }, { status: 400, headers: NO_STORE })

    const feed = sitemapFeedFor(configuredSiteOrigin())
    if (!feed) return NextResponse.json({ ok: false, error: 'Set SITE_URL first, so the sitemap address is known.' }, { status: 400, headers: NO_STORE })

    const engine = await getEngine()
    const result = await submitSitemap(engine as never, site, feed)
    if (!result.ok) {
      const status = result.status === 404 ? 404 : result.status === 401 || result.status === 403 ? 403 : 502
      return NextResponse.json({ ok: false, error: result.error }, { status, headers: NO_STORE })
    }
    return NextResponse.json({ ok: true, message: result.message }, { headers: NO_STORE })
  } catch (error) {
    console.error('admin-google-sitemap POST error:', error)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500, headers: NO_STORE })
  }
}
