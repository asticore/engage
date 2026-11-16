/**
 * Task 25a: single sign-on per organisation (OpenID Connect). Pure rules; no I/O.
 * An organisation connects its identity provider, proves it owns its email domains with a DNS record,
 * and people with an address on a verified domain can sign in through it. Optionally the organisation
 * enforces it, so those addresses can no longer use a password.
 */

export type DomainClaim = { domain: string; token: string; verifiedAt: string | null }

export type SsoConnection = {
  id: string
  orgId: string
  name: string
  /** The identity provider's issuer address; discovery is read from `<issuer>/.well-known/openid-configuration`. */
  issuer: string
  clientId: string
  /** Decrypted. Server use only. */
  clientSecret: string
  domains: DomainClaim[]
  /** The organisation role a new member gets. Never owner. */
  defaultRole: string
  /** Create the account on first sign-in when none exists. */
  jit: boolean
  /** Addresses on a verified domain may sign in only through this connection. */
  enforce: boolean
  enabled: boolean
}

export const ASSIGNABLE_ROLES = ['member', 'admin'] as const
export const DNS_PREFIX = '_engage-sso'
export const MAX_DOMAINS = 10

const DOMAIN_SHAPE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

/** Lower-cased domain, or null when it is not a plain registrable-looking domain. */
export function normaliseDomain(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const value = input.trim().toLowerCase().replace(/^@/, '').replace(/\.$/, '')
  return DOMAIN_SHAPE.test(value) ? value : null
}

export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf('@')
  return at > 0 ? normaliseDomain(email.slice(at + 1)) : null
}

/** The DNS name and value an owner must publish to prove the domain is theirs. */
export const verificationRecord = (domain: string, token: string): { name: string; value: string } => ({ name: `${DNS_PREFIX}.${domain}`, value: `engage-sso-verify=${token}` })

/** True when any answered TXT string is the expected value (quotes and splitting by the resolver are ignored). */
export function txtProves(answers: readonly string[], value: string): boolean {
  return answers.some((a) => a.replace(/^"|"$/g, '').replace(/"\s*"/g, '').trim() === value)
}

const isHttpsIssuer = (value: string): boolean => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && url.hostname.includes('.') && !/^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname)
  } catch {
    return false
  }
}

export const discoveryUrlFor = (issuer: string): string => `${issuer.replace(/\/+$/, '')}/.well-known/openid-configuration`

export type ConnectionInput = { orgId: string; name: string; issuer: string; clientId: string; clientSecret: string; defaultRole: string; jit: boolean; enforce: boolean; enabled: boolean }

/** Validates the editable fields. The secret may be empty on an update (the stored one is kept). */
export function validateConnectionInput(raw: Record<string, unknown>, opts: { requireSecret: boolean }): { ok: true; value: ConnectionInput } | { ok: false; error: string } {
  const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const orgId = str(raw.orgId, 64)
  const name = str(raw.name, 80)
  const issuer = str(raw.issuer, 300)
  const clientId = str(raw.clientId, 300)
  const clientSecret = str(raw.clientSecret, 600)
  if (!orgId) return { ok: false, error: 'Choose an organisation.' }
  if (!name) return { ok: false, error: 'Give the connection a name.' }
  if (!isHttpsIssuer(issuer)) return { ok: false, error: 'The issuer must be a secure https address on a real host name.' }
  if (!clientId) return { ok: false, error: 'Enter the client ID.' }
  if (opts.requireSecret && !clientSecret) return { ok: false, error: 'Enter the client secret.' }
  const role = str(raw.defaultRole, 40) || 'member'
  if (!(ASSIGNABLE_ROLES as readonly string[]).includes(role)) return { ok: false, error: 'New people can be given the member or admin role, never owner.' }
  return { ok: true, value: { orgId, name, issuer, clientId, clientSecret, defaultRole: role, jit: raw.jit !== false, enforce: raw.enforce === true, enabled: raw.enabled === true } }
}

/** The connection that handles an email address: enabled, with the address's domain verified. */
export function connectionForEmail(connections: readonly SsoConnection[], email: string): SsoConnection | null {
  const domain = emailDomain(email)
  if (!domain) return null
  return connections.find((c) => c.enabled && c.domains.some((d) => d.domain === domain && d.verifiedAt)) ?? null
}

/** The connection that forces this address through SSO, or null. */
export function enforcingConnection(connections: readonly SsoConnection[], email: string): SsoConnection | null {
  const c = connectionForEmail(connections, email)
  return c && c.enforce ? c : null
}

export const ENFORCED_MESSAGE = 'Your organisation requires single sign-on. Use the single sign-on link on the sign-in page.'

export const publicView = (c: SsoConnection): Omit<SsoConnection, 'clientSecret'> & { hasSecret: boolean } => {
  const { clientSecret, ...rest } = c
  return { ...rest, hasSecret: Boolean(clientSecret) }
}
