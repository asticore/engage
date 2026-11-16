/**
 * Task 25b: SCIM 2.0 provisioning for an organisation. Pure helpers: resource shapes, filter, patch and errors.
 * Spec: RFC 7643 (resources) and RFC 7644 (protocol). Only what identity providers (Okta, Entra ID, Google) use.
 */

export const USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User'
export const GROUP_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:Group'
export const LIST_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:ListResponse'
export const ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error'
export const PATCH_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:PatchOp'
export const MAX_PAGE = 100

export type ScimResult = { status: number; body?: unknown }

export const scimError = (status: number, detail: string, scimType?: string): ScimResult => ({
  status,
  body: { schemas: [ERROR_SCHEMA], status: String(status), detail, ...(scimType ? { scimType } : {}) },
})

export type ScimUser = {
  id: number
  email: string
  externalId: string | null
  active: boolean
  givenName: string
  familyName: string
}

export const userResource = (u: ScimUser, base: string): Record<string, unknown> => ({
  schemas: [USER_SCHEMA],
  id: String(u.id),
  ...(u.externalId ? { externalId: u.externalId } : {}),
  userName: u.email,
  name: { givenName: u.givenName, familyName: u.familyName, formatted: `${u.givenName} ${u.familyName}`.trim() },
  emails: [{ value: u.email, primary: true, type: 'work' }],
  active: u.active,
  meta: { resourceType: 'User', location: `${base}/Users/${u.id}` },
})

export type ScimGroup = { id: string; displayName: string; memberIds: number[] }

export const groupResource = (g: ScimGroup, base: string): Record<string, unknown> => ({
  schemas: [GROUP_SCHEMA],
  id: g.id,
  displayName: g.displayName,
  members: g.memberIds.map((id) => ({ value: String(id) })),
  meta: { resourceType: 'Group', location: `${base}/Groups/${g.id}` },
})

export const listResponse = (resources: unknown[], total: number, startIndex: number): ScimResult => ({
  status: 200,
  body: { schemas: [LIST_SCHEMA], totalResults: total, startIndex, itemsPerPage: resources.length, Resources: resources },
})

/** Paging parameters: startIndex is 1-based; count is capped. */
export function paging(params: URLSearchParams): { start: number; count: number } {
  const start = Math.max(1, Math.floor(Number(params.get('startIndex')) || 1))
  const raw = params.get('count')
  const count = raw === null ? MAX_PAGE : Math.min(MAX_PAGE, Math.max(0, Math.floor(Number(raw)) || 0))
  return { start, count }
}

/** The one filter identity providers send: `attr eq "value"` (userName, externalId, displayName, id). */
export function parseEqFilter(filter: string | null): { attr: string; value: string } | null | 'unsupported' {
  if (!filter || !filter.trim()) return null
  const m = /^\s*([A-Za-z][A-Za-z0-9.]*)\s+eq\s+"((?:[^"\\]|\\.)*)"\s*$/i.exec(filter)
  if (!m) return 'unsupported'
  return { attr: m[1].toLowerCase(), value: m[2].replace(/\\(.)/g, '$1') }
}

export const normEmail = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const v = value.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254 ? v : null
}

const text = (v: unknown, max = 120): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** What a create or replace body says about a user. Email comes from userName, falling back to the primary email. */
export function readUserBody(body: unknown): { email: string | null; externalId: string | null; active: boolean | null; givenName: string; familyName: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const emails = Array.isArray(b.emails) ? (b.emails as Array<Record<string, unknown>>) : []
  const primary = emails.find((e) => e && e.primary === true) ?? emails[0]
  const name = (b.name && typeof b.name === 'object' ? b.name : {}) as Record<string, unknown>
  return {
    email: normEmail(b.userName) ?? normEmail(primary?.value),
    externalId: text(b.externalId, 200) || null,
    active: typeof b.active === 'boolean' ? b.active : b.active === 'true' ? true : b.active === 'false' ? false : null,
    givenName: text(name.givenName),
    familyName: text(name.familyName),
  }
}

export type PatchChange = { active?: boolean; externalId?: string | null; addMembers: number[]; removeMembers: number[]; replaceMembers: number[] | null; displayName?: string }

const asBool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : v === 'True' || v === 'true' ? true : v === 'False' || v === 'false' ? false : undefined)
const memberIds = (v: unknown): number[] =>
  (Array.isArray(v) ? v : [v])
    .map((m) => Number((m as { value?: unknown } | null)?.value))
    .filter((n) => Number.isInteger(n) && n > 0)

/** Reads a PatchOp body for the attributes this server supports. Unknown attributes are ignored, as the spec allows. */
export function readPatch(body: unknown): PatchChange | null {
  const b = (body && typeof body === 'object' ? body : {}) as { Operations?: unknown }
  if (!Array.isArray(b.Operations)) return null
  const out: PatchChange = { addMembers: [], removeMembers: [], replaceMembers: null }
  for (const raw of b.Operations as Array<Record<string, unknown>>) {
    const op = String(raw?.op ?? '').toLowerCase()
    const path = typeof raw?.path === 'string' ? raw.path : ''
    const value = raw?.value
    if (op !== 'add' && op !== 'replace' && op !== 'remove') return null
    // Entra sends members removal as path `members[value eq "12"]`.
    const removeMatch = /^members\[value eq "(\d+)"\]$/i.exec(path)
    if (op === 'remove' && removeMatch) {
      out.removeMembers.push(Number(removeMatch[1]))
      continue
    }
    if (path.toLowerCase() === 'members') {
      if (op === 'add') out.addMembers.push(...memberIds(value))
      else if (op === 'replace') out.replaceMembers = memberIds(value)
      else if (op === 'remove') out.removeMembers.push(...memberIds(value))
      continue
    }
    if (op === 'remove') {
      if (path === 'externalId') out.externalId = null
      continue
    }
    if (path === 'active') {
      const a = asBool(value)
      if (a !== undefined) out.active = a
    } else if (path === 'externalId') out.externalId = text(value, 200) || null
    else if (path === 'displayName') out.displayName = text(value, 80)
    else if (!path && value && typeof value === 'object') {
      const v = value as Record<string, unknown>
      const a = asBool(v.active)
      if (a !== undefined) out.active = a
      if (typeof v.externalId === 'string') out.externalId = text(v.externalId, 200) || null
      if (typeof v.displayName === 'string') out.displayName = text(v.displayName, 80)
      if (Array.isArray(v.members)) {
        if (op === 'add') out.addMembers.push(...memberIds(v.members))
        else out.replaceMembers = memberIds(v.members)
      }
    }
  }
  return out
}

export const SERVICE_PROVIDER_CONFIG = {
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
  patch: { supported: true },
  bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
  filter: { supported: true, maxResults: MAX_PAGE },
  changePassword: { supported: false },
  sort: { supported: false },
  etag: { supported: false },
  authenticationSchemes: [{ type: 'oauthbearertoken', name: 'Bearer token', description: 'A token made for the organisation in the admin.', primary: true }],
}

export const TOKEN_PREFIX = 'scim_'
export const tokenShape = (t: string): boolean => /^scim_[A-Za-z0-9_-]{43}$/.test(t)
