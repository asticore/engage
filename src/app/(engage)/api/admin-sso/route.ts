import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { MAX_DOMAINS, normaliseDomain, publicView, validateConnectionInput, verificationRecord, txtProves, type SsoConnection } from '@/features/orgSso/core'
import { lookupTxt } from '@/features/orgSso/service'
import * as store from '@/features/orgSso/store'
import { defaultOrgStore } from '@/features/organizations/store'
import { adminRequestRefusal } from '@/features/forms/origin'
import { publicOrigin } from '@/features/google/origin'
import { randomToken } from '@/features/socialLogin/util'
import * as scim from '@/features/scim/store'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function guard(request: Request, write: boolean) {
  if (write) {
    const refusal = adminRequestRefusal(request)
    if (refusal) return { response: json({ error: refusal }, 403) }
  }
  const context = await getAdminContext()
  if (!context.user) return { response: json({ error: 'Please sign in again.' }, 401) }
  if (!context.isAdmin) return { response: json({ error: 'Only an admin can manage single sign-on.' }, 403) }
  if (!(await getFeatureFlags()).sso) return { response: json({ error: 'Switch Single sign-on on in Site Settings first.' }, 409) }
  return { context }
}

const view = (c: SsoConnection) => ({ ...publicView(c), records: c.domains.map((d) => ({ domain: d.domain, verified: Boolean(d.verifiedAt), ...verificationRecord(d.domain, d.token) })) })

export async function GET(request: Request): Promise<Response> {
  const g = await guard(request, false)
  if (!g.context) return g.response
  const [connections, orgs, tokens] = await Promise.all([store.listConnections(), defaultOrgStore.listAllOrgs(200), scim.listTokens()])
  return json({ scimBase: `${publicOrigin(request.url)}/api/scim/v2`, scim: tokens, redirectUri: `${publicOrigin(request.url)}/api/sso/callback`, orgs: orgs.map((o) => ({ id: o.id, name: o.name })), connections: connections.map(view) })
}

/**
 * POST { action: 'save', id?, ...fields } | { action: 'delete', id } | { action: 'add-domain', id, domain }
 *    | { action: 'remove-domain', id, domain } | { action: 'verify-domain', id, domain }
 */
export async function POST(request: Request): Promise<Response> {
  const g = await guard(request, true)
  if (!g.context) return g.response
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'Invalid request.' }, 400)
  const now = new Date().toISOString()
  if (body.action === 'scim-rotate' || body.action === 'scim-disable') {
    const orgId = typeof body.orgId === 'string' ? body.orgId : ''
    if (!orgId || !(await defaultOrgStore.getOrg(orgId))) return json({ error: 'Unknown organisation.' }, 400)
    if (body.action === 'scim-disable') {
      await scim.disableToken(orgId)
      return json({ ok: true })
    }
    return json({ ok: true, token: await scim.rotateToken(orgId, now) })
  }
  const id = typeof body.id === 'string' ? body.id : ''
  const existing = id ? await store.getConnection(id) : null

  if (body.action === 'save') {
    const input = validateConnectionInput(body, { requireSecret: !existing })
    if (input.ok === false) return json({ error: input.error }, 400)
    if (!(await defaultOrgStore.getOrg(input.value.orgId))) return json({ error: 'Unknown organisation.' }, 400)
    if (id && !existing) return json({ error: 'Unknown connection.' }, 404)
    const conn: SsoConnection = {
      id: existing?.id ?? crypto.randomUUID(),
      ...input.value,
      clientSecret: input.value.clientSecret || existing?.clientSecret || '',
      domains: existing?.domains ?? [],
    }
    if (conn.enforce && !conn.domains.some((d) => d.verifiedAt)) return json({ error: 'Verify at least one domain before you enforce single sign-on.' }, 400)
    if (existing) await store.updateConnection(conn, now)
    else await store.insertConnection(conn, now)
    return json({ ok: true, id: conn.id })
  }
  if (!existing) return json({ error: 'Unknown connection.' }, 404)
  if (body.action === 'delete') {
    await store.deleteConnection(existing.id)
    return json({ ok: true })
  }
  const domain = normaliseDomain(body.domain)
  if (!domain) return json({ error: 'Enter a domain such as example.com.' }, 400)
  if (body.action === 'add-domain') {
    if (existing.domains.length >= MAX_DOMAINS) return json({ error: `At most ${MAX_DOMAINS} domains per connection.` }, 400)
    if (existing.domains.some((d) => d.domain === domain)) return json({ error: 'That domain is already on this connection.' }, 400)
    const taken = (await store.listConnections()).some((c) => c.domains.some((d) => d.domain === domain && d.verifiedAt))
    if (taken) return json({ error: 'That domain is already verified for another connection.' }, 409)
    const next = { ...existing, domains: [...existing.domains, { domain, token: randomToken(18), verifiedAt: null }] }
    await store.updateConnection(next, now)
    return json({ ok: true })
  }
  if (body.action === 'remove-domain') {
    const left = existing.domains.filter((d) => d.domain !== domain)
    const next = { ...existing, domains: left, enforce: existing.enforce && left.some((d) => d.verifiedAt) }
    await store.updateConnection(next, now)
    return json({ ok: true })
  }
  if (body.action === 'verify-domain') {
    const claim = existing.domains.find((d) => d.domain === domain)
    if (!claim) return json({ error: 'Add the domain first.' }, 404)
    const record = verificationRecord(domain, claim.token)
    const answers = await lookupTxt(record.name, fetch)
    if (answers === null) return json({ error: 'The DNS lookup failed. Try again in a minute.' }, 502)
    if (!txtProves(answers, record.value)) return json({ error: `No matching record found yet. Add a TXT record named ${record.name} with the value ${record.value}. DNS changes can take a while.` }, 422)
    const taken = (await store.listConnections()).some((c) => c.id !== existing.id && c.domains.some((d) => d.domain === domain && d.verifiedAt))
    if (taken) return json({ error: 'That domain is already verified for another connection.' }, 409)
    await store.updateConnection({ ...existing, domains: existing.domains.map((d) => (d.domain === domain ? { ...d, verifiedAt: now } : d)) }, now)
    return json({ ok: true })
  }
  return json({ error: 'Unknown action.' }, 400)
}
