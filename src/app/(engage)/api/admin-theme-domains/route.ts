import { NextRequest, NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { readDomainsFromD1 } from '@/features/domains/store'
import { adminRequestRefusal } from '@/features/forms/origin'
import { loadAllDomainOverrides, saveDomainOverrides } from '@/features/themeStyles/domainStore'
import { loadThemeStyles } from '@/features/themeStyles/store'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

async function adminRefusal(): Promise<Response | null> {
  const context = await getAdminContext()
  if (!context.user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  if (!context.isAdmin) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403, headers: NO_STORE })
  return null
}

/** GET /api/admin-theme-domains: the master theme (the primary domain's), each other domain and its overrides. Admins only. */
export async function GET(): Promise<Response> {
  try {
    const refusal = await adminRefusal()
    if (refusal) return refusal
    const [domains, overrides, { styles }] = await Promise.all([readDomainsFromD1(), loadAllDomainOverrides(), loadThemeStyles()])
    const master = domains.find((domain) => domain.isPrimary)?.host ?? null
    return NextResponse.json(
      {
        ok: true,
        master,
        domains: domains.filter((domain) => !domain.isPrimary).map((domain) => ({ host: domain.host, label: domain.label, overrides: overrides.get(domain.host) ?? null })),
        colours: styles.colours,
      },
      { headers: NO_STORE },
    )
  } catch (error) {
    console.error('admin-theme-domains GET error:', error instanceof Error ? error.name : 'unknown')
    return NextResponse.json({ ok: false, error: 'The domain themes could not be loaded.' }, { status: 500, headers: NO_STORE })
  }
}

/** POST /api/admin-theme-domains { host, overrides }: saves one registered, non-primary domain's overrides. Admins only. */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const originRefusal = adminRequestRefusal(request)
    if (originRefusal) return NextResponse.json({ ok: false, error: originRefusal }, { status: 403, headers: NO_STORE })
    const refusal = await adminRefusal()
    if (refusal) return refusal
    const body = (await request.json().catch((): null => null)) as { host?: unknown; overrides?: unknown } | null
    const host = typeof body?.host === 'string' ? body.host.trim().toLowerCase() : ''
    const domains = await readDomainsFromD1()
    const domain = domains.find((candidate) => candidate.host === host)
    if (!domain) return NextResponse.json({ ok: false, error: 'That domain is not registered.' }, { status: 400, headers: NO_STORE })
    if (domain.isPrimary) return NextResponse.json({ ok: false, error: 'The primary domain is the master theme. Change it on this page, not here.' }, { status: 400, headers: NO_STORE })
    const saved = await saveDomainOverrides(host, body?.overrides)
    return NextResponse.json({ ok: true, overrides: saved }, { headers: NO_STORE })
  } catch (error) {
    console.error('admin-theme-domains POST error:', error instanceof Error ? error.name : 'unknown')
    return NextResponse.json({ ok: false, error: 'The domain theme could not be saved. Try again.' }, { status: 500, headers: NO_STORE })
  }
}
