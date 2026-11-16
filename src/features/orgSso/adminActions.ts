import { NextResponse } from 'next/server'

import { MAX_DOMAINS, normaliseDomain, publicView, validateConnectionInput, verificationRecord, txtProves, validateSamlInput, type SsoConnection } from '@/features/orgSso/core'
import { readIdpMetadata } from '@/features/orgSso/saml'
import { lookupTxt } from '@/features/orgSso/service'
import * as store from '@/features/orgSso/store'
import { defaultOrgStore } from '@/features/organizations/store'
import { publicOrigin } from '@/features/google/origin'
import { randomToken } from '@/features/socialLogin/util'
import * as scim from '@/features/scim/store'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

const view = (c: SsoConnection) => ({ ...publicView(c), records: c.domains.map((d) => ({ domain: d.domain, verified: Boolean(d.verifiedAt), ...verificationRecord(d.domain, d.token) })) })


export async function ssoAdminList(origin: string, scopeOrg: string | null) {
  const [connections, orgs, tokens] = await Promise.all([store.listConnections(), defaultOrgStore.listAllOrgs(200), scim.listTokens()])
  const keep = <T extends { orgId?: string; id?: string }>(rows: T[], key: 'orgId' | 'id'): T[] => (scopeOrg ? rows.filter((r) => r[key] === scopeOrg) : rows)
  return {
    scimBase: `${origin}/api/scim/v2`,
    scim: keep(tokens as Array<{ orgId: string }>, 'orgId'),
    redirectUri: `${origin}/api/sso/callback`,
    samlAcs: `${origin}/api/sso/saml/acs`,
    samlMetadataBase: `${origin}/api/sso/saml/metadata`,
    orgs: keep(orgs, 'id').map((o) => ({ id: o.id, name: o.name })),
    connections: keep(connections, 'orgId').map(view),
  }
}

/**
 * POST { action: 'save', id?, protocol?, ...fields } | delete | add-domain | remove-domain | verify-domain | scim-rotate | scim-disable
 */
export async function ssoAdminPost(body: Record<string, unknown>, scopeOrg: string | null): Promise<Response> {
  // An organisation owner may only touch their own organisation: its id is forced, never read from the request.
  if (scopeOrg) body = { ...body, orgId: scopeOrg }
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
  if (scopeOrg && existing && existing.orgId !== scopeOrg) return json({ error: 'Unknown connection.' }, 404)

  if (body.action === 'save' && body.protocol === 'saml') {
    const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
    const orgId = str(body.orgId, 64)
    const name = str(body.name, 80)
    if (!orgId || !(await defaultOrgStore.getOrg(orgId))) return json({ error: 'Choose an organisation.' }, 400)
    if (!name) return json({ error: 'Give the connection a name.' }, 400)
    if (id && !existing) return json({ error: 'Unknown connection.' }, 404)
    let fields: Record<string, unknown> = { ...body }
    const xml = str(body.metadataXml, 200000)
    if (xml) {
      const meta = readIdpMetadata(xml)
      if (!meta) return json({ error: 'That metadata file could not be read. It needs an entity ID, an HTTP-Redirect sign-in address and a signing certificate.' }, 400)
      fields = { ...fields, entityId: meta.entityId, ssoUrl: meta.ssoUrl, certificate: meta.keys.join('\n') }
    } else if (existing?.saml && !str(body.certificate, 12000)) {
      fields = { ...fields, certificate: existing.saml.keys.join('\n') }
    }
    const saml = validateSamlInput(fields)
    if (saml.ok === false) return json({ error: saml.error }, 400)
    const role = str(body.defaultRole, 40) || 'member'
    if (role !== 'member' && role !== 'admin') return json({ error: 'New people can be given the member or admin role, never owner.' }, 400)
    const conn: SsoConnection = {
      id: existing?.id ?? crypto.randomUUID(),
      orgId: existing?.orgId ?? orgId,
      name,
      issuer: saml.value.ssoUrl,
      clientId: 'saml',
      clientSecret: 'saml',
      defaultRole: role,
      jit: body.jit !== false,
      enforce: body.enforce === true,
      enabled: body.enabled === true,
      domains: existing?.domains ?? [],
    }
    if (conn.enforce && !conn.domains.some((d) => d.verifiedAt)) return json({ error: 'Verify at least one domain before you enforce single sign-on.' }, 400)
    if (existing) await store.updateConnection(conn, now)
    else await store.insertConnection(conn, now)
    await store.saveSaml(conn.id, saml.value)
    return json({ ok: true, id: conn.id })
  }

  if (body.action === 'save') {
    if (existing?.saml) return json({ error: 'This is a SAML connection. Save it as SAML.' }, 400)
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
