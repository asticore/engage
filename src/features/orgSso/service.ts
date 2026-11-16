import { emailDomain, type SsoConnection } from './core'

/**
 * What happens after the identity provider has proved who someone is. Everything the rules touch is injected, so
 * they are tested without a database. The rules, because this is where account takeover would happen:
 *   1. The address must be present, marked verified (the connection's owner vouches for the provider), and on one of
 *      the connection's VERIFIED domains. Anything else is refused: a provider cannot vouch for other people's domains.
 *   2. An identity already linked to this connection signs in as its owner.
 *   3. Otherwise an existing CUSTOMER account with the same address is linked. A staff account is never linked this
 *      way (staff link from the signed-in security screen); the person is refused.
 *   4. Otherwise, when just-in-time creation is on, a customer is created (never another role).
 *   5. The person is always made a member of the organisation, with the connection's default role. An existing
 *      membership and its role are left alone.
 */

export type SsoIdentity = { subject: string; email: string | null; emailVerified: boolean }

export type SsoUser = { id: number; email: string; roles: string[] }

export type SsoDeps = {
  findLink(connId: string, subject: string): Promise<number | null>
  insertLink(connId: string, subject: string, userId: number): Promise<void>
  findUserByID(id: number): Promise<SsoUser | null>
  findUserByEmail(email: string): Promise<SsoUser | null>
  createCustomer(email: string): Promise<number>
  /** Adds the person to the organisation if they are not a member yet. Never changes an existing role. */
  ensureMember(orgId: string, userId: number, role: string): Promise<void>
}

export type SsoRefusal = 'no-email' | 'unverified-email' | 'domain' | 'staff-account' | 'signup-disabled' | 'not-found'
export type SsoOutcome = { ok: boolean; userId?: number; created?: boolean; code?: SsoRefusal }

const refuse = (code: SsoRefusal): SsoOutcome => ({ ok: false, code })
const isStaff = (roles: string[]): boolean => roles.some((r) => r === 'admin' || r === 'editor' || r === 'viewer')

export async function completeSso(deps: SsoDeps, conn: SsoConnection, identity: SsoIdentity): Promise<SsoOutcome> {
  const email = identity.email ? identity.email.trim().toLowerCase() : null
  if (!email) return refuse('no-email')
  if (!identity.emailVerified) return refuse('unverified-email')
  const domain = emailDomain(email)
  if (!domain || !conn.domains.some((d) => d.domain === domain && d.verifiedAt)) return refuse('domain')

  const linked = await deps.findLink(conn.id, identity.subject)
  if (linked !== null) {
    const user = await deps.findUserByID(linked)
    if (!user) return refuse('not-found')
    if (isStaff(user.roles)) return refuse('staff-account')
    await deps.ensureMember(conn.orgId, user.id, conn.defaultRole)
    return { ok: true, userId: user.id, created: false }
  }

  const existing = await deps.findUserByEmail(email)
  if (existing) {
    if (isStaff(existing.roles)) return refuse('staff-account')
    await deps.insertLink(conn.id, identity.subject, existing.id)
    await deps.ensureMember(conn.orgId, existing.id, conn.defaultRole)
    return { ok: true, userId: existing.id, created: false }
  }

  if (!conn.jit) return refuse('signup-disabled')
  const id = await deps.createCustomer(email)
  await deps.insertLink(conn.id, identity.subject, id)
  await deps.ensureMember(conn.orgId, id, conn.defaultRole)
  return { ok: true, userId: id, created: true }
}

/** Looks the domain's proof up over DNS-over-HTTPS. Returns the TXT strings, or null when the lookup failed. */
export async function lookupTxt(name: string, fetchImpl: typeof fetch): Promise<string[] | null> {
  try {
    const res = await fetchImpl(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`, { headers: { Accept: 'application/dns-json' } })
    if (!res.ok) return null
    const body = (await res.json()) as { Answer?: Array<{ type?: number; data?: string }> }
    return (body.Answer ?? []).filter((a) => a.type === 16 && typeof a.data === 'string').map((a) => String(a.data))
  } catch {
    return null
  }
}
