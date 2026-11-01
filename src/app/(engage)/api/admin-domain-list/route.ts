import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { getEngine } from '@/lib/engine'
import { attachConfigured } from '@/features/domains/cloudflareAttach'

export const dynamic = 'force-dynamic'

/**
 * GET: the registered domains (host, name, status, primary) and whether Connect domain is set up, for the domain picker on pages, posts, products,
 * users and roles, and for the DNS checklist on Settings > Domains. Host names are not secret, so any signed-in
 * admin-panel user can read them; the registry itself stays admin-only to change.
 */
export async function GET(): Promise<Response> {
  const ctx = await getAdminContext()
  if (!ctx.user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const engine = await getEngine()
  const doc = (await engine.findGlobal({ slug: 'domain-settings', depth: 0 }).catch((): null => null)) as
    | { domains?: unknown }
    | null
  const rows = Array.isArray(doc?.domains) ? (doc.domains as Record<string, unknown>[]) : []
  const domains = rows
    .filter((row) => typeof row.host === 'string' && row.host.length > 0)
    .map((row) => ({
      host: row.host as string,
      label: typeof row.label === 'string' ? row.label : '',
      status: row.status === 'disabled' ? 'disabled' : 'active',
      isPrimary: Boolean(row.isPrimary),
    }))
  const integrations = await engine.findGlobal({ slug: 'integrations', depth: 0, overrideAccess: true }).catch((): null => null)
  return NextResponse.json({ domains, attachConfigured: attachConfigured(integrations) })
}
