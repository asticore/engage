import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { isChoiceAllowed, resolveAdminSite, saveSiteChoice } from '@/features/domains/adminSite'

export const dynamic = 'force-dynamic'

/**
 * POST: remember the admin site this person works on. Body: { site: "<host>" | "all" }.
 * The server checks the choice against the sites this account may use, so a limited account cannot pick another
 * site, and "all" is refused unless the account has no domain limit.
 * Returns: { ok: true, site, effective }
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const context = await getAdminContext()
    if (!context.user) return NextResponse.json({ error: 'unauthorised' }, { status: 401 })

    let body: { site?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { visible } = await resolveAdminSite(context.engine, context.user)
    if (!isChoiceAllowed(body.site, visible)) {
      return NextResponse.json({ error: 'That site is not one of this account\'s sites.' }, { status: 403 })
    }

    await saveSiteChoice(context.engine, context.user, body.site)
    const resolved = await resolveAdminSite(context.engine, context.user)
    return NextResponse.json({ ok: true, site: body.site, effective: resolved.host }, { status: 200 })
  } catch (error) {
    console.error('admin-site-choice POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
