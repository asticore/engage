import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { attachSettingsFrom, attachWorkerDomain } from '@/features/domains/cloudflareAttach'
import { registeredSites } from '@/features/domains/adminSite'
import { normaliseHost } from '@/features/domains/host'
import { can } from '@/features/roles/permissions'

export const dynamic = 'force-dynamic'

/**
 * POST: Connect domain. Body: { host }. Attaches a registered domain to the site's Worker when the Cloudflare account ID,
 * Worker name, zone and API token are saved (Settings > Integrations > Cloudflare). Otherwise answers reason
 * "not-configured" and the screen keeps showing the manual steps.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const context = await getAdminContext()
    if (!context.user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    if (!context.isAdmin && !can(context.user as never, 'domains', 'update')) {
      return NextResponse.json({ error: 'Changing domains needs the Domain access permission.' }, { status: 403 })
    }

    let body: { host?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const parsed = normaliseHost(body.host)
    if (parsed.ok === false) return NextResponse.json({ error: 'Choose a registered domain.' }, { status: 400 })

    const registered = (await registeredSites(context.engine)).some((site) => site.host === parsed.host && site.status === 'active')
    if (!registered) return NextResponse.json({ error: 'That domain is not registered and active.' }, { status: 400 })

    const integrations = await context.engine.findGlobal({ slug: 'integrations', depth: 0, overrideAccess: true }).catch((): null => null)
    const settings = attachSettingsFrom(integrations)
    if (!settings) return NextResponse.json({ ok: false, reason: 'not-configured', message: 'Not set up yet.' }, { status: 200 })

    const result = await attachWorkerDomain(parsed.host, settings)
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('admin-domain-attach POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
